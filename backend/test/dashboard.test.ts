import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// The windows and the query rules are proved against a database in dashboard.integration.test.ts.
// Here a fake pool shows that the route is read-only, uses the injected service date and passes the
// day windows to the queries.
test('the dashboard reads with the service date and the windows, and writes nothing', async () => {
  const calls: { text: string; values: unknown[] }[] = [];
  const pool = {
    query: async (text: string, values: unknown[] = []) => {
      calls.push({ text, values });
      return { rows: text.includes('AS educations') ? [{ educations: 2 }] : [] };
    },
  } as unknown as Pool;
  await withApi(
    pool,
    async (call) => {
      const { status, data } = await call('/api/dashboard');
      assert.equal(status, 200);
      assert.equal(data.today, '2026-11-16');
      assert.deepEqual(data.counts, { educations: 2 });
      assert.deepEqual(data.windows, { deadlineDays: 14, interviewDays: 14, expiryDays: 90 });
    },
    { today: () => '2026-11-16' },
  );
  assert.equal(calls.length, 5);
  assert.ok(calls.every((c) => /^\s*SELECT/i.test(c.text)));
  assert.ok(calls.some((c) => c.values[0] === '2026-11-16' && c.values[1] === 14));
  assert.ok(calls.some((c) => c.values[0] === '2026-11-16' && c.values[1] === 90));
});
