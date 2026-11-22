# Bound database and shutdown waits in the API server (#189)

- `backend/src/server.ts`: the pool has `connectionTimeoutMillis` 5 s and `statement_timeout` 10 s, so a database that accepts the connection but never answers gives a 503 from `/api/health` (and a 500 from data routes) instead of hanging.
- `PORT` must be a whole number from 1 to 65535; otherwise the server exits 1 with a message (`Number('abc')` was `NaN`, and `listen(NaN)` picked a random port).
- Shutdown (SIGTERM/SIGINT) waits for requests in flight, then closes the pool and exits 0. After `SHUTDOWN_TIMEOUT_MS` (default 8000, below docker's 10 s) the remaining connections are cut and the process exits 1; a second signal exits at once.
- Tests (`backend/test/server-start.test.ts`): bad `PORT`; a TCP listener that never answers as the database (503 within the timeout; shutdown stops at its deadline).
