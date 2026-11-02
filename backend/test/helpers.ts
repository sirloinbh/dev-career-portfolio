import type { Pool } from 'pg';

import { createApp } from '../src/app.js';

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
