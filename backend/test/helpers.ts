import type { Server } from 'node:http';
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

/**
 * Ports fetch refuses to send to ("bad ports" in the Fetch standard; Node's fetch fails with
 * `fetch failed`, cause `bad port`). `listen(0)` can get one where the OS hands out low ports:
 * Windows here uses 1024-15000, which holds 1719, 2049, 5060, 6000, 6665-6669, 10080, and others (#77).
 */
export const fetchBlockedPorts: ReadonlySet<number> = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95, 101, 102,
  103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465,
  512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989, 990, 993,
  995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668,
  6669, 6679, 6697, 10080,
]);

const close = (server: Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );

/**
 * Starts a server on a port the OS picks and fetch can reach. A fetch-blocked port is closed and
 * another one asked for, up to `attempts` times.
 */
export async function listenForFetch(
  start: () => Server,
  isBlocked: (port: number) => boolean = (port) => fetchBlockedPorts.has(port),
  attempts = 20,
) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const server = start();
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      await close(server);
      throw new Error('No TCP address');
    }
    if (!isBlocked(address.port)) return { server, port: address.port };
    await close(server);
  }
  throw new Error(`No port that fetch can reach after ${String(attempts)} attempts`);
}

type ApiResult = { status: number; data: Record<string, unknown> };
type ApiRequest = { method?: string; body?: unknown };

export async function withApi(
  pool: Pool,
  run: (call: (path: string, request?: ApiRequest) => Promise<ApiResult>) => Promise<void>,
  options: Parameters<typeof createApp>[1] = {},
) {
  const { server, port } = await listenForFetch(() =>
    createApp(pool, options).listen(0, '127.0.0.1'),
  );
  try {
    await run(async (path, request = {}) => {
      const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, {
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
    await close(server);
  }
}
