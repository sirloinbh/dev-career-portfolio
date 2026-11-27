import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockPortfolio, testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'an application remembers its highlighted projects, newest project first, and they go with either side',
  { skip: !url },
  async (t) => {
    await lockPortfolio(t);
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM applications');
    await pool.query('DELETE FROM projects');

    await withApi(pool, async (call) => {
      const addProject = async (name: string, startDate: string) => {
        const response = await call('/api/projects', {
          method: 'POST',
          body: { name, startDate, endDate: null },
        });
        assert.equal(response.status, 201);
        return (response.data.project as { id: number }).id;
      };
      const older = await addProject('Older', '2020-01-01');
      const newer = await addProject('Newer', '2024-01-01');
      const created = await call('/api/applications', {
        method: 'POST',
        body: { companyName: '한국소프트', status: 'drafting' },
      });
      const applicationId = (created.data.application as { id: number }).id;
      const path = `/api/applications/${String(applicationId)}/projects`;

      assert.deepEqual((await call(path)).data, { projectIds: [] });

      // Saved as a whole; a repeated id counts once; newest project first.
      const saved = await call(path, {
        method: 'PUT',
        body: { projectIds: [older, newer, older] },
      });
      assert.equal(saved.status, 200);
      assert.deepEqual(saved.data, { projectIds: [newer, older] });
      assert.deepEqual((await call(path)).data, { projectIds: [newer, older] });

      // Replacing keeps only the new list.
      assert.deepEqual((await call(path, { method: 'PUT', body: { projectIds: [older] } })).data, {
        projectIds: [older],
      });

      // An unknown project is a 400 and changes nothing.
      const unknown = await call(path, { method: 'PUT', body: { projectIds: [older, 999999] } });
      assert.equal(unknown.status, 400);
      assert.equal(unknown.data.error, 'Project not found');
      assert.deepEqual((await call(path)).data, { projectIds: [older] });

      // An unknown application is a 404 on both verbs.
      assert.equal((await call('/api/applications/999999/projects')).status, 404);
      assert.equal(
        (
          await call('/api/applications/999999/projects', {
            method: 'PUT',
            body: { projectIds: [] },
          })
        ).status,
        404,
      );

      // Deleting a project removes its link; deleting the application removes the rest.
      assert.equal(
        (await call(`/api/projects/${String(older)}`, { method: 'DELETE' })).status,
        204,
      );
      assert.deepEqual((await call(path)).data, { projectIds: [] });
      await call(path, { method: 'PUT', body: { projectIds: [newer] } });
      assert.equal(
        (await call(`/api/applications/${String(applicationId)}`, { method: 'DELETE' })).status,
        204,
      );
      const left = await pool.query('SELECT count(*)::int AS n FROM application_projects');
      assert.equal(left.rows[0].n, 0);
    });
  },
);
