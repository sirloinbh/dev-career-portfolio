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
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`PORT must be a whole number from 1 to 65535, got "${process.env.PORT}"`);
  process.exit(1);
}
// #189: a database that accepts the connection but stops answering must not hold a request (or the health check) forever.
const pool = createPool(
  new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
  }),
);
// The sign-in is on in compose (AUTH_INTERNAL_URL), so the server listens on every interface behind the proxy; a local run
// without it listens on 127.0.0.1 only (#898).
const auth = sharedAuth();
const server = createApp(pool, { auth, toolsPublicKey: process.env.AI_TOOLS_PUBLIC_KEY }).listen(
  port,
  listenHost(auth !== undefined),
  () => console.log(`API http://localhost:${port}`),
);
// docker stop sends SIGTERM and Ctrl+C sends SIGINT: both stop accepting requests, wait for requests in flight, then close
// the pool. After the deadline the open connections are cut (docker would send SIGKILL after 10 s anyway), and a second
// signal exits at once.
const shutdownMs = Number(process.env.SHUTDOWN_TIMEOUT_MS ?? 8_000);
let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    setTimeout(() => {
      console.error('Shutdown deadline reached; closing the remaining connections');
      server.closeAllConnections();
      process.exit(1);
    }, shutdownMs).unref();
    server.close(() => {
      void pool.end().then(() => process.exit(0));
    });
  });
}
