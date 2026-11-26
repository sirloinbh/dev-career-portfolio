import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { dataTables, skippedTables } from '../src/routes/data.js';
import { testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();
const schema = 'export_test';
const migrations = fileURLToPath(new URL('../../database/migrations/', import.meta.url));

type Call = Parameters<Parameters<typeof withApi>[1]>[0];
type Tables = Record<string, Record<string, unknown>[]>;

// The other test files empty and refill the shared tables in parallel, so a test that wipes every
// table works in its own schema (a copy of all migrations) and leaves their data alone.
async function createSchema() {
  const admin = new Pool({ connectionString: url, max: 1 });
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.query(`CREATE SCHEMA ${schema}`);
  const client = await admin.connect();
  try {
    await client.query(`SET search_path = ${schema}`);
    for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
      await client.query(await readFile(`${migrations}${file}`, 'utf8'));
    }
  } finally {
    client.release();
    await admin.end();
  }
  return new Pool({ connectionString: url, options: `-c search_path=${schema}` });
}

async function seed(pool: Pool) {
  await pool.query(`INSERT INTO app_settings (key, value) VALUES ('theme', '어두운 화면')`);
  await pool.query(
    `INSERT INTO educations (school, major, degree, status, start_date, end_date, gpa, gpa_scale, memo)
     VALUES ('한국대학교', '컴퓨터공학', 'bachelor', 'graduated', '2014-03-02', '2020-02-20', 3.85, 4.5, '졸업')`,
  );
  await pool.query(
    `INSERT INTO careers (company, department, position, employment_type, start_date, end_date, duties)
     VALUES ('한빛소프트', '개발팀', '백엔드 개발자', 'full_time', '2020-03-02', NULL, '결제 API 개발')`,
  );
  await pool.query(
    `INSERT INTO projects (name, organization, start_date, summary, technologies, career_id)
     VALUES ('주문 관리 서비스', '한빛소프트', '2021-01-04', '주문 처리', ARRAY['TypeScript', '한글 도구'], (SELECT id FROM careers LIMIT 1))`,
  );
  await pool.query(
    `INSERT INTO skills (name, category, proficiency, memo) VALUES ('TypeScript', 'language', 4, '주력')`,
  );
  await pool.query(
    `INSERT INTO certifications (name, issuer, acquired_date, expiry_date, score)
     VALUES ('정보처리기사', '한국산업인력공단', '2019-06-09', '2029-06-08', '합격')`,
  );
  await pool.query(
    `INSERT INTO applications (company_name, position, deadline, status, memo)
     VALUES ('구름데이터', '백엔드 개발', '2026-12-05', 'drafting', '링크 첨부')`,
  );
  await pool.query(
    `INSERT INTO cover_letter_questions (application_id, question, answer, char_limit, display_order)
     VALUES ((SELECT id FROM applications LIMIT 1), '지원 동기는?', '성장하고 싶습니다', 500, 0),
            ((SELECT id FROM applications LIMIT 1), '강점은?', NULL, NULL, 1)`,
  );
}

const exportAll = async (call: Call) => {
  const { status, data } = await call('/api/data/export');
  assert.equal(status, 200);
  return data as { format: string; version: number; exportedAt: string; tables: Tables };
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'export, wipe and import give the same rows back, Korean text included (#222)',
  { skip: !url },
  async (t) => {
    const pool = await createSchema();
    t.after(async () => {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    });

    // Every table of the schema is either exported or knowingly left out, so a new table cannot be forgotten.
    const { rows: found } = await pool.query<{ name: string }>(
      `SELECT table_name AS name FROM information_schema.tables
     WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'`,
    );
    const known = new Set<string>([...dataTables.map((table) => table.name), ...skippedTables]);
    assert.deepEqual(
      found.map((table) => table.name).filter((name) => !known.has(name)),
      [],
      'a table is neither exported nor listed in skippedTables (backend/src/routes/data.ts)',
    );

    await seed(pool);
    await withApi(pool, async (call) => {
      const before = await exportAll(call);
      assert.equal(before.format, 'dev-career-portfolio-export');
      assert.equal(before.version, 1);
      assert.equal(before.tables.educations?.[0]?.school, '한국대학교');
      assert.equal(before.tables.cover_letter_questions?.length, 2);
      for (const table of dataTables) {
        assert.ok((before.tables[table.name]?.length ?? 0) > 0, `${table.name} has a seeded row`);
      }

      // Wipe everything, add a stray row the file does not have, then import the file.
      await pool.query(
        `TRUNCATE ${dataTables.map((table) => table.name).join(', ')} RESTART IDENTITY`,
      );
      await pool.query(
        `INSERT INTO skills (name, category, proficiency) VALUES ('Stray', 'tool', 1)`,
      );
      const imported = await call('/api/data/import', { method: 'POST', body: before });
      assert.equal(imported.status, 200);
      assert.deepEqual(
        (imported.data.imported as Record<string, number>).cover_letter_questions,
        2,
      );

      const after = await exportAll(call);
      assert.deepEqual(after.tables, before.tables);

      // Replace, not merge: the stray row is gone. New rows continue after the highest imported id.
      const ids = after.tables.skills?.map((row) => row.name);
      assert.deepEqual(ids, ['TypeScript']);
      const added = await call('/api/skills', {
        method: 'POST',
        body: { name: 'Go', category: 'language', proficiency: 3 },
      });
      assert.equal(added.status, 201);
      assert.equal((added.data.skill as { id: number }).id, 2);
    });
  },
);

test('a broken or wrong file changes nothing (#222)', { skip: !url }, async (t) => {
  const pool = await createSchema();
  t.after(async () => {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  });
  await seed(pool);
  await withApi(pool, async (call) => {
    const before = await exportAll(call);
    const refuse = async (body: unknown, message: RegExp) => {
      const { status, data } = await call('/api/data/import', { method: 'POST', body });
      assert.equal(status, 400);
      assert.match(String(data.error), message);
      assert.deepEqual((await exportAll(call)).tables, before.tables);
    };

    const good = { ...before, tables: { ...before.tables, skills: [] } };
    await refuse({ ...good, version: 2 }, /Unsupported export version/);
    await refuse({ ...good, format: 'x' }, /not a Dev Career Portfolio export/);
    await refuse(
      { ...good, tables: { ...good.tables, skills: [{ id: 1, nope: 1 }] } },
      /unknown column nope/,
    );
    await refuse(
      { ...good, tables: { ...good.tables, skills: [{ id: 1, name: 'x' }] } },
      /missing column/,
    );

    // A row the database refuses, after valid rows were already inserted: the whole import rolls back.
    const stamp = '2026-01-01T00:00:00.000Z';
    const skill = (proficiency: number) => ({
      id: 1,
      name: 'Rust',
      category: 'language',
      proficiency,
      memo: null,
      created_at: stamp,
      updated_at: stamp,
    });
    await refuse(
      { ...good, tables: { ...good.tables, skills: [skill(9)] } },
      /Table skills has a row the database refuses/,
    );
    // A pointer to a row the file does not contain is refused too.
    const orphan = { ...before.tables.cover_letter_questions?.[0], application_id: 999 };
    await refuse(
      { ...good, tables: { ...good.tables, applications: [], cover_letter_questions: [orphan] } },
      /refuses/,
    );
  });
});
