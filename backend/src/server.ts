import { Pool } from 'pg';

import { createApp } from './app.js';
import { listenHost, sharedAuth } from './standard/auth.js';
import { createPool } from './standard/db.js';

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL is required (for example postgres://career:<password>@127.0.0.1:15408/career)',
  );
  process.exit(1);
}
const port = Number(process.env.PORT ?? 3108);
const pool = createPool(new Pool({ connectionString: process.env.DATABASE_URL }));
// The sign-in is on in compose (AUTH_INTERNAL_URL), so the server listens on every interface behind the proxy; a local run
// without it listens on 127.0.0.1 only (#898).
const auth = sharedAuth();
const server = createApp(pool, { auth, toolsPublicKey: process.env.AI_TOOLS_PUBLIC_KEY }).listen(
  port,
  listenHost(auth !== undefined),
  () => console.log(`API http://localhost:${port}`),
);
// docker stop sends SIGTERM and Ctrl+C sends SIGINT: both stop accepting requests, then close the pool.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () =>
    server.close(() => {
      void pool.end();
    }),
  );
}
