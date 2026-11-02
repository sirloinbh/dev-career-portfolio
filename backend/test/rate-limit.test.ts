import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

test('requests over the limit get a Korean 429 and never reach the database', async () => {
  let queries = 0;
  const pool = {
    query: async () => {
      queries += 1;
      return { rows: [] };
    },
  } as unknown as Pool;

  await withApi(
    pool,
    async (call) => {
      assert.equal((await call('/api/educations')).status, 200);
      assert.equal((await call('/api/educations')).status, 200);
      const refused = await call('/api/educations');
      assert.equal(refused.status, 429);
      assert.equal(refused.data.error, '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요');
    },
    { rateLimit: { limit: 2 } },
  );
  assert.equal(queries, 2);
});

test('the default limit leaves normal use alone', async () => {
  const pool = { query: async () => ({ rows: [] }) } as unknown as Pool;
  await withApi(pool, async (call) => {
    for (let request = 0; request < 50; request += 1) {
      assert.equal((await call('/api/educations')).status, 200);
    }
  });
});
