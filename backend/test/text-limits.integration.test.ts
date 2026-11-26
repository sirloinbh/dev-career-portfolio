import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockPortfolio,testDatabaseUrl } from './helpers.js';

const url = testDatabaseUrl();

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'the database refuses blank and over-length text that skips the API (#136)',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await lockPortfolio(t);
    const insert = (company: string, extra = '', value: string | null = null) =>
      pool.query(
        `INSERT INTO careers (company, employment_type, start_date${extra ? `, ${extra}` : ''})
       VALUES ($1, 'other', '2020-01-01'${extra ? ', $2' : ''})`,
        extra ? [company, value] : [company],
      );
    const refused = (name: string) => (error: unknown) =>
      (error as { constraint?: string }).constraint === name;

    await assert.rejects(insert('   '), refused('careers_company_text'));
    await assert.rejects(insert('x'.repeat(101)), refused('careers_company_text'));
    await assert.rejects(
      insert('회사', 'duties', 'x'.repeat(2001)),
      refused('careers_duties_text'),
    );
    await assert.rejects(insert('회사', 'department', '  '), refused('careers_department_text'));

    // The limits themselves and NULL stay allowed; clean up what was written.
    await pool.query('DELETE FROM careers');
    await insert('x'.repeat(100), 'duties', 'y'.repeat(2000));
    await insert('회사');
    await pool.query('DELETE FROM careers');
  },
);
