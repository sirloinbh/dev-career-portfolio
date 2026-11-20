# Adopt the shared db and rate-limit modules (project-standards#709, part 1)

- The cover-letter question transaction runs on the managed `withTransaction` (a typed one-liner keeps the call sites); a failed ROLLBACK still destroys the connection.
- `src/pool.ts` (`connectPool`): the managed `createPool` plus a per-connection `error` listener (pg stops listening on a checked-out client). The server had no error listener before.
- `src/rate-limit.ts` is removed; `app.ts` uses the managed `apiRateLimit(app)`: 600 per minute per client IP (the last X-Forwarded-For entry, which nginx appends), health not counted. The old default was 1200 and counted every request as one client. The `rateLimit` option is now `requestsPerMinute`.
- Not in this PR: the OpenAPI builder (needs typed path params in the managed builder). The ids-as-numbers change is project-standards#781.
- Verification: typecheck, eslint, prettier, non-DB tests. DB tests run in CI.
