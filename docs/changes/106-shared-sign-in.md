# #106 Require the shared sign-in

## Change

- `backend/src/app.ts`: `createApp` takes an `auth` middleware and mounts it on `/api` after the rate limiter and body parser and before any route; `/api/health` stays open (the middleware's `publicPaths`). New `GET /api/me` returns the signed-in user.
- `backend/src/server.ts`: passes `sharedAuth()` (managed file `standard/auth.ts`), which builds the middleware when `AUTH_INTERNAL_URL` is set and refuses to start in production without it.
- `compose.yaml`: the API joins the external `shared-auth` network and checks sessions at `http://shared-auth-api:3110`.
- `frontend/src/app.tsx`: the app is wrapped in `SignInGate` and the top bar shows `AccountActions` (managed files `sign-in.tsx`, `auth-origin.ts`). On `<app>.<domain>` a signed-out visitor goes to `https://auth.<domain>/sign-in`. On localhost and IP addresses nothing changes.
- `backend/test/sign-in.test.ts`: 401 without a session, `/api/me` and an API route with one.
- `README.md`: the sign-in rule and the 401/503 responses. This app has no `docs/api.md` or OpenAPI contract.

## Reason

- The app had no login and relied only on the IP allow list. The shared sign-in is live (sirloinbh/project-standards ADR-0015, #550, #551); this follows the workout-memo pilot (#303). It is an owner-only app with no public pages.

## Verification

- Local: format, lint and typecheck pass; backend `sign-in` and `health` tests (7 pass); frontend `app` and `auth-origin` tests (15 pass); `node .standards/check.mjs` passes. The tests that need PostgreSQL and the rest of the frontend run in CI.
- `npm install --ignore-scripts` (user step) and `node .standards/lockfiles.mjs --write` updated the lockfiles for `@sirloinbh/auth-client` 1.0.0.
