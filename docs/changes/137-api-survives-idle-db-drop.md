# Keep the API running when an idle database connection drops (#137)

- Already on main: the pool error listeners (`createPool` in `standard/db.ts`, #159), the sign-in-off warning (`sharedAuth`, #667) and the `HOST`-aware bind (`listenHost`, #898).
- `backend/src/server.ts` now exits with a clear message when `DATABASE_URL` is missing, and handles `SIGINT` like `SIGTERM`.
- `compose.yaml` sets `HOST: 0.0.0.0` for the api service (the host still publishes the port on 127.0.0.1 only).
- Tests (`backend/test/server-start.test.ts`): missing `DATABASE_URL`, sign-in-off warning plus clean exit on SIGINT, and pool/connection `error` events not throwing.
