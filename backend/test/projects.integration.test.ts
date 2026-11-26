import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

// All projects and links here are made up for the test.
const shop = {
  name: '  주문 관리 서비스  ',
  organization: '한빛소프트',
  startDate: '2024-01-08',
  endDate: '2024-06-28',
  role: '백엔드',
  summary: '주문과 배송을 한 화면에서 관리',
  contributions: '',
  repositoryUrl: 'https://github.com/example/shop',
  serviceUrl: '',
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test('projects are stored, listed newest first, updated and deleted', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM projects');
  // Two skills, named so that their order by name is the opposite of their order by id.
  await pool.query("DELETE FROM skills WHERE name LIKE 'Zz %'");
  t.after(() => pool.query("DELETE FROM skills WHERE name LIKE 'Zz %'"));
  const made = await pool.query<{ id: number }>(
    `INSERT INTO skills (name, category, proficiency)
     VALUES ('Zz Beta', 'tool', 1), ('Zz Alpha', 'tool', 1) RETURNING id`,
  );
  const [beta, alpha] = made.rows.map((row) => row.id) as [number, number];
  // The next ids cross 9 to 10, so a text sort of ids would show in the same-day check below.
  await pool.query("SELECT setval(pg_get_serial_sequence('projects', 'id'), 8)");

  await withApi(pool, async (call) => {
    // Still running: the end date stays NULL, the optional text NULL and the list empty.
    const running = await call('/api/projects', {
      method: 'POST',
      body: { name: '포트폴리오 사이트', startDate: '2025-03-03' },
    });
    assert.equal(running.status, 201);
    assert.deepEqual(running.data.project, {
      id: 9,
      name: '포트폴리오 사이트',
      organization: null,
      careerId: null,
      startDate: '2025-03-03',
      endDate: null,
      role: null,
      summary: null,
      contributions: null,
      skillIds: [],
      repositoryUrl: null,
      serviceUrl: null,
    });

    // Sent beta first: the answer lists them by skill name, alpha first.
    const created = await call('/api/projects', {
      method: 'POST',
      body: { ...shop, skillIds: [beta, alpha] },
    });
    assert.equal(created.status, 201);
    const project = created.data.project as Record<string, unknown>;
    assert.deepEqual(project, {
      id: 10,
      name: '주문 관리 서비스',
      organization: '한빛소프트',
      careerId: null,
      startDate: '2024-01-08',
      endDate: '2024-06-28',
      role: '백엔드',
      summary: '주문과 배송을 한 화면에서 관리',
      contributions: null,
      skillIds: [alpha, beta],
      repositoryUrl: 'https://github.com/example/shop',
      serviceUrl: null,
    });

    // Same start date as the running project, added later, so it comes first.
    const sameDay = await call('/api/projects', {
      method: 'POST',
      body: { name: '사내 도구', startDate: '2025-03-03' },
    });
    assert.equal(sameDay.status, 201);

    const list = await call('/api/projects');
    assert.equal(list.status, 200);
    const names = (list.data.projects as { name: string }[]).map((row) => row.name);
    assert.deepEqual(names, ['사내 도구', '포트폴리오 사이트', '주문 관리 서비스']);

    const updated = await call(`/api/projects/${String(project.id)}`, {
      method: 'PUT',
      body: {
        name: '주문 관리 서비스 2',
        organization: '다온테크',
        startDate: '2024-01-09',
        endDate: null,
        role: '팀장',
        summary: 'Summary 2',
        contributions: '응답 시간 40% 단축',
        skillIds: [beta],
        repositoryUrl: 'HTTPS://github.com/example/shop2',
        serviceUrl: 'http://shop.example.com',
      },
    });
    assert.equal(updated.status, 200);
    // Every column changes, so a column left out of SET or two swapped parameters would show here.
    assert.deepEqual(updated.data.project, {
      id: project.id,
      name: '주문 관리 서비스 2',
      organization: '다온테크',
      careerId: null,
      startDate: '2024-01-09',
      endDate: null,
      role: '팀장',
      summary: 'Summary 2',
      contributions: '응답 시간 40% 단축',
      skillIds: [beta],
      repositoryUrl: 'HTTPS://github.com/example/shop2',
      serviceUrl: 'http://shop.example.com',
    });

    const removed = await call(`/api/projects/${String(project.id)}`, { method: 'DELETE' });
    assert.equal(removed.status, 204);
    const after = await call('/api/projects');
    assert.equal((after.data.projects as unknown[]).length, 2);

    for (const request of [{ method: 'PUT', body: shop }, { method: 'DELETE' }]) {
      const missing = await call(`/api/projects/${String(project.id)}`, request);
      assert.equal(missing.status, 404);
      assert.equal(missing.data.error, 'Project not found');
    }
  });
});

test('the database itself refuses rows the API would refuse', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const insert = (fields: { end?: string; link?: string }) =>
    pool.query(
      `INSERT INTO projects (name, start_date, end_date, repository_url)
       VALUES ('프로젝트', '2020-01-02', $1, $2)`,
      [fields.end ?? null, fields.link ?? null],
    );
  await assert.rejects(insert({ end: '2020-01-01' }), /projects_period/);
  await assert.rejects(insert({ link: 'javascript:alert(1)' }), /projects_links/);
});

test(
  'a project links to a career, unlinks, and keeps living when the career is deleted',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());

    await withApi(pool, async (call) => {
      const career = await call('/api/careers', {
        method: 'POST',
        body: { company: 'Link Test Co', employmentType: 'full_time', startDate: '2022-01-03' },
      });
      assert.equal(career.status, 201);
      const careerId = (career.data.career as { id: number }).id;

      const linked = await call('/api/projects', {
        method: 'POST',
        body: { name: 'Linked project', startDate: '2022-02-01', careerId },
      });
      assert.equal(linked.status, 201);
      const project = linked.data.project as { id: number; careerId: number | null };
      assert.equal(project.careerId, careerId);

      // A career id that does not exist is refused, on create and on update.
      const missing = {
        name: 'Linked project',
        startDate: '2022-02-01',
        careerId: careerId + 100000,
      };
      const refusedCreate = await call('/api/projects', { method: 'POST', body: missing });
      assert.equal(refusedCreate.status, 400);
      assert.equal(refusedCreate.data.error, 'Career not found');
      const refusedUpdate = await call(`/api/projects/${String(project.id)}`, {
        method: 'PUT',
        body: missing,
      });
      assert.equal(refusedUpdate.status, 400);
      assert.equal(refusedUpdate.data.error, 'Career not found');

      // Unlinking and linking again through PUT.
      const unlinked = await call(`/api/projects/${String(project.id)}`, {
        method: 'PUT',
        body: { name: 'Linked project', startDate: '2022-02-01', careerId: null },
      });
      assert.equal((unlinked.data.project as { careerId: unknown }).careerId, null);
      const relinked = await call(`/api/projects/${String(project.id)}`, {
        method: 'PUT',
        body: { name: 'Linked project', startDate: '2022-02-01', careerId },
      });
      assert.equal((relinked.data.project as { careerId: unknown }).careerId, careerId);

      // Deleting the career keeps the project and clears its link.
      const removed = await call(`/api/careers/${String(careerId)}`, { method: 'DELETE' });
      assert.equal(removed.status, 204);
      const list = await call('/api/projects');
      const kept = (list.data.projects as { id: number; careerId: unknown }[]).find(
        (row) => row.id === project.id,
      );
      assert.equal(kept?.careerId, null);

      await call(`/api/projects/${String(project.id)}`, { method: 'DELETE' });
    });
  },
);

test(
  'a project keeps its skill links, refuses an unknown skill, and loses a link when the skill is deleted',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query("DELETE FROM skills WHERE name LIKE 'Zz Link %'");
    t.after(() => pool.query("DELETE FROM skills WHERE name LIKE 'Zz Link %'"));
    const made = await pool.query<{ id: number }>(
      `INSERT INTO skills (name, category, proficiency)
     VALUES ('Zz Link One', 'tool', 1), ('Zz Link Two', 'tool', 1) RETURNING id`,
    );
    const [one, two] = made.rows.map((row) => row.id) as [number, number];

    await withApi(pool, async (call) => {
      const base = { name: 'Skill link project', startDate: '2023-01-02' };
      const created = await call('/api/projects', {
        method: 'POST',
        body: { ...base, skillIds: [two, one] },
      });
      assert.equal(created.status, 201);
      const project = created.data.project as { id: number; skillIds: number[] };
      assert.deepEqual(project.skillIds, [one, two]);

      // An unknown skill is refused and the project keeps its links (the whole write rolls back).
      const unknown = { ...base, skillIds: [one, two + 100000] };
      const refusedCreate = await call('/api/projects', { method: 'POST', body: unknown });
      assert.equal(refusedCreate.status, 400);
      assert.equal(refusedCreate.data.error, 'Skill not found');
      const refusedUpdate = await call(`/api/projects/${String(project.id)}`, {
        method: 'PUT',
        body: unknown,
      });
      assert.equal(refusedUpdate.status, 400);
      assert.equal(refusedUpdate.data.error, 'Skill not found');
      const list = await call('/api/projects');
      const same = (list.data.projects as { id: number; skillIds: number[] }[]).find(
        (row) => row.id === project.id,
      );
      assert.deepEqual(same?.skillIds, [one, two]);

      // Replacing the list drops links that are not in it; an empty list drops them all.
      const narrowed = await call(`/api/projects/${String(project.id)}`, {
        method: 'PUT',
        body: { ...base, skillIds: [two] },
      });
      assert.deepEqual((narrowed.data.project as { skillIds: number[] }).skillIds, [two]);

      // Deleting a skill removes its link and keeps the project.
      await pool.query('DELETE FROM skills WHERE id = $1', [two]);
      const after = await call('/api/projects');
      const kept = (after.data.projects as { id: number; skillIds: number[] }[]).find(
        (row) => row.id === project.id,
      );
      assert.deepEqual(kept?.skillIds, []);

      await call(`/api/projects/${String(project.id)}`, { method: 'DELETE' });
    });
  },
);
