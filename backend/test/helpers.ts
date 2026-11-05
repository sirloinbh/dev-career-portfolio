import type { TestContext } from 'node:test';

import { Client, type Pool } from 'pg';

import { createApp } from '../src/app.js';

// Test files run in parallel processes. Deleting applications also deletes their cover letter
// questions (#37), so every test that clears either table holds this lock for its whole run.
const applicationsLock = 37_036;

export async function lockApplications(t: TestContext) {
  const client = new Client({ connectionString: testDatabaseUrl() });
  await client.connect();
  await client.query('SELECT pg_advisory_lock($1)', [applicationsLock]);
  // Closing the session releases the lock, even when the test fails.
  t.after(() => client.end());
}

// TEST_DATABASE_URL is often a machine-wide variable set for another project. These tests delete
// rows, so they only ever run against this app's dedicated test database and skip anywhere else.
export function testDatabaseUrl() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return undefined;
  return new URL(url).pathname === '/career_test' ? url : undefined;
}

type ApiResult = { status: number; data: Record<string, unknown> };
type ApiRequest = { method?: string; body?: unknown };

export async function withApi(
  pool: Pool,
  run: (call: (path: string, request?: ApiRequest) => Promise<ApiResult>) => Promise<void>,
  options: Parameters<typeof createApp>[1] = {},
) {
  const server = createApp(pool, options).listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No TCP address');
    await run(async (path, request = {}) => {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        method: request.method ?? 'GET',
        ...(request.body === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(request.body),
            }),
      });
      const text = await response.text();
      return {
        status: response.status,
        data: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
      };
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
