import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockPortfolio, testDatabaseUrl, withApi } from './helpers.js';

// Share links (#236) against a real database: the choice of items, revoking and the 404s. Skipped without TEST_DATABASE_URL.
const url = testDatabaseUrl();

test(
  'a link returns only its chosen items, and a revoked link returns 404',
  { skip: !url },
  async (t) => {
    await lockPortfolio(t);
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    const chosen = await pool.query<{ id: number }>(
      `INSERT INTO projects (name, start_date, summary) VALUES ('Shared project', '2024-01-01', 'visible') RETURNING id`,
    );
    const other = await pool.query<{ id: number }>(
      `INSERT INTO projects (name, start_date, summary) VALUES ('Private project', '2024-02-01', 'hidden') RETURNING id`,
    );
    const education = await pool.query<{ id: number }>(
      `INSERT INTO educations (school, major, degree, status, start_date, memo)
     VALUES ('Some University', 'CS', 'bachelor', 'graduated', '2014-03-02', 'private memo') RETURNING id`,
    );
    t.after(async () => {
      await pool.query('DELETE FROM share_links WHERE label = $1', ['integration']);
      await pool.query('DELETE FROM projects WHERE id = ANY($1::bigint[])', [
        [chosen.rows[0]?.id, other.rows[0]?.id],
      ]);
      await pool.query('DELETE FROM educations WHERE id = $1', [education.rows[0]?.id]);
    });

    await withApi(pool, async (call) => {
      const created = await call('/api/share-links', {
        method: 'POST',
        body: {
          label: 'integration',
          projects: [chosen.rows[0]?.id],
          educations: [education.rows[0]?.id],
        },
      });
      assert.equal(created.status, 201);
      const token = created.data.token as string;

      const shared = await call(`/api/share/${token}`);
      assert.equal(shared.status, 200);
      const text = JSON.stringify(shared.data);
      assert.match(text, /Shared project/);
      assert.match(text, /Some University/);
      assert.doesNotMatch(text, /Private project/);
      assert.doesNotMatch(text, /private memo/);

      const listed = await call('/api/share-links');
      assert.ok(!JSON.stringify(listed.data).includes(token), 'the list never holds a token');

      const link = created.data.shareLink as { id: number };
      const revoked = await call(`/api/share-links/${String(link.id)}/revoke`, { method: 'POST' });
      assert.equal(revoked.status, 200);
      assert.ok((revoked.data.shareLink as { revokedAt: string | null }).revokedAt);
      assert.equal((await call(`/api/share/${token}`)).status, 404);
      // Revoking again keeps the first revocation time and still answers 200.
      assert.equal(
        (await call(`/api/share-links/${String(link.id)}/revoke`, { method: 'POST' })).status,
        200,
      );
      assert.equal(
        (await call('/api/share-links/999999999/revoke', { method: 'POST' })).status,
        404,
      );
    });
  },
);
