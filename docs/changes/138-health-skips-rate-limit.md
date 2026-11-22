# Exempt health checks from the API rate limit (#138)

- Already on main: the managed `apiRateLimit` skips `/health` (`skip` in `standard/rate-limit.ts`), keys by the last `X-Forwarded-For` entry with `trust proxy` 1, and `rate-limit.test.ts` proves the health check is not counted.
- `GET /api/health` now answers 503 `{ ok: false }` when `SELECT 1` fails, instead of the generic 500.
- Tests (`backend/test/health.test.ts`): 503 on a failing pool; a data route still answers the generic 500.
