import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

test('requests over the limit get an English 429 and never reach the database', async () => {
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
      assert.equal(refused.data.error, 'Too many requests. Try again in a minute.');
    },
    { requestsPerMinute: 2 },
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

test('the health check is not counted, and the client is the last X-Forwarded-For entry', async () => {
  const pool = { query: async () => ({ rows: [] }) } as unknown as Pool;
  await withApi(
    pool,
    async (call) => {
      const from = (address: string, path = '/api/educations') =>
        call(path, { headers: { 'x-forwarded-for': `198.51.100.9, ${address}` } });
      assert.equal((await from('203.0.113.1', '/api/health')).status, 200);
      assert.equal((await from('203.0.113.1', '/api/health')).status, 200);
      assert.equal((await from('203.0.113.1')).status, 200);
      assert.equal((await from('203.0.113.1')).status, 429);
      assert.equal((await from('203.0.113.2')).status, 200);
    },
    { requestsPerMinute: 1 },
  );
});
