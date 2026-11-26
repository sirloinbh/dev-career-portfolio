import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockProjects, testDatabaseUrl, withApi } from './helpers.js';

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
  technologies: [' TypeScript ', 'PostgreSQL'],
  repositoryUrl: 'https://github.com/example/shop',
  serviceUrl: '',
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test('projects are stored, listed newest first, updated and deleted', { skip: !url }, async (t) => {
  await lockProjects(t);
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM projects');
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
      technologies: [],
      repositoryUrl: null,
      serviceUrl: null,
    });

    const created = await call('/api/projects', { method: 'POST', body: shop });
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
      technologies: ['TypeScript', 'PostgreSQL'],
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
        technologies: ['Go'],
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
      technologies: ['Go'],
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
  await lockProjects(t);
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const insert = (fields: { end?: string; technologies?: string[]; link?: string }) =>
    pool.query(
      `INSERT INTO projects (name, start_date, end_date, technologies, repository_url)
       VALUES ('프로젝트', '2020-01-02', $1, $2, $3)`,
      [fields.end ?? null, fields.technologies ?? [], fields.link ?? null],
    );
  await assert.rejects(insert({ end: '2020-01-01' }), /projects_period/);
  await assert.rejects(
    insert({ technologies: Array.from({ length: 31 }, (_, index) => String(index)) }),
    /projects_technologies_count/,
  );
  await assert.rejects(insert({ link: 'javascript:alert(1)' }), /projects_links/);
});

test(
  'a project links to a career, unlinks, and keeps living when the career is deleted',
  { skip: !url },
  async (t) => {
    await lockProjects(t);
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
