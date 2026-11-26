import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockPortfolio, testDatabaseUrl } from './helpers.js';

const url = testDatabaseUrl();

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'the database refuses blank and over-length technology items that skip the API (#191)',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await lockPortfolio(t);
    const insert = (technologies: (string | null)[]) =>
      pool.query(
        `INSERT INTO projects (name, start_date, technologies) VALUES ('프로젝트', '2020-01-01', $1)`,
        [technologies],
      );
    const refused = (error: unknown) =>
      (error as { constraint?: string }).constraint === 'projects_technologies_items';

    await assert.rejects(insert(['React', '']), refused);
    await assert.rejects(insert(['  ']), refused);
    await assert.rejects(insert([null]), refused);
    await assert.rejects(insert(['x'.repeat(51)]), refused);

    // A 50-character item and an empty list stay allowed; clean up what was written.
    try {
      await insert(['x'.repeat(50), 'Go']);
      await insert([]);
    } finally {
      await pool.query('DELETE FROM projects');
    }
  },
);
