import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

const university = {
  school: '  한국대학교  ',
  major: '컴퓨터공학',
  degree: 'bachelor',
  status: 'graduated',
  startDate: '2015-03-02',
  endDate: '2019-02-20',
  gpa: 3.75,
  gpaScale: 4.5,
  memo: '',
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'educations are stored, listed newest first, updated and deleted',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM educations');

    await withApi(pool, async (call) => {
      const created = await call('/api/educations', { method: 'POST', body: university });
      assert.equal(created.status, 201);
      const education = created.data.education as Record<string, unknown>;
      assert.equal(typeof education.id, 'number');
      assert.deepEqual(education, {
        id: education.id,
        school: '한국대학교',
        major: '컴퓨터공학',
        degree: 'bachelor',
        status: 'graduated',
        startDate: '2015-03-02',
        endDate: '2019-02-20',
        gpa: 3.75,
        gpaScale: 4.5,
        memo: null,
      });

      // Still enrolled: the end date stays NULL and the optional fields stay NULL too.
      const enrolled = await call('/api/educations', {
        method: 'POST',
        body: {
          school: '대학원',
          degree: 'master',
          status: 'enrolled',
          startDate: '2024-03-04',
        },
      });
      assert.equal(enrolled.status, 201);
      const graduate = enrolled.data.education as Record<string, unknown>;
      assert.equal(graduate.endDate, null);
      assert.equal(graduate.major, null);
      assert.equal(graduate.gpa, null);

      const list = await call('/api/educations');
      assert.equal(list.status, 200);
      const schools = (list.data.educations as { school: string }[]).map((row) => row.school);
      assert.deepEqual(schools, ['대학원', '한국대학교']);

      const updated = await call(`/api/educations/${String(education.id)}`, {
        method: 'PUT',
        body: { ...university, status: 'dropped_out', gpa: null, gpaScale: null },
      });
      assert.equal(updated.status, 200);
      const changed = updated.data.education as Record<string, unknown>;
      assert.equal(changed.status, 'dropped_out');
      assert.equal(changed.gpa, null);

      const removed = await call(`/api/educations/${String(education.id)}`, { method: 'DELETE' });
      assert.equal(removed.status, 204);
      const after = await call('/api/educations');
      assert.equal((after.data.educations as unknown[]).length, 1);

      for (const request of [{ method: 'PUT', body: university }, { method: 'DELETE' }]) {
        const missing = await call(`/api/educations/${String(education.id)}`, request);
        assert.equal(missing.status, 404);
        assert.equal(missing.data.error, '학력을 찾을 수 없습니다');
      }
    });
  },
);

test(
  'the database itself refuses a period that ends before it starts',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await assert.rejects(
      pool.query(
        `INSERT INTO educations (school, degree, status, start_date, end_date)
       VALUES ('학교', 'other', 'graduated', '2020-01-02', '2020-01-01')`,
      ),
      /educations_period/,
    );
  },
);
