# Decision: how a read-only portfolio page is shared (#235)

Status: chosen by the user on 2026-11-27 (access model and link mechanism).

## Current state

- Every `/api` route except `/api/health` already needs a session from the shared sign-in (`@sirloinbh/auth-client`, `sirloinbh/shared-auth`, #106). `createApp` mounts the guard with `app.use('/api', options.auth)`, before any route. Without a session the answer is 401, and 503 when the sign-in service is unreachable.
- Production refuses to start without `AUTH_INTERNAL_URL`. A local run without it listens on 127.0.0.1 only.
- The web container publishes port 8108 on `127.0.0.1` locally; on the server the shared proxy forwards `dev-career-portfolio.daysofme.com` to it. nginx proxies `/api/` to the API container, so a public path under `/api/` reaches the API with no proxy change.
- The tools route `/internal/tools` is outside `/api` and is signed by shared-ai, so it is unaffected.

## Options

| Option                                                             | How it works                                                                   | Risks                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Token link only                                                    | A random link opens the chosen items; the rest of the app is unchanged         | Needs the rest of the app to be private anyway; a leaked link works until it is revoked |
| Static export                                                      | Generate an HTML file and host it elsewhere                                    | A copy that goes stale; no revoke once sent; a second hosting target to secure          |
| **Whole app behind a login, with one public share route (chosen)** | The login stays on every private route; one route serves only the chosen items | The public route is the only unauthenticated data path, so it must be small and tested  |

## Decision (user, 2026-11-27)

Put the whole app behind a login first, then make the shared portfolio page a public route. Not chosen: a static HTML export, or a revocable token link on its own.

The first part is already true on main (#106), so no new login is built. Password storage, session length and where the password comes from are owned by shared-auth, so this project adds no password code, session table or auth secret.

## Share link mechanism (chosen for #236: option A)

- A `share_links` table holds a SHA-256 hash of a random 256-bit token (the token itself is shown once), the chosen item ids, `created_at` and `revoked_at`.
- `GET /api/share/:token` is registered in `app.ts` before the `/api` guard. It returns only the chosen items, read-only, and answers 404 for an unknown, malformed or revoked token (the same answer for all three, so a token cannot be probed).
- Creating, listing and revoking links stay behind the login.
- No other public route exists; only `GET` is served on the share path, so the shared page cannot call any edit API.
- `share_links` holds credentials, so it is excluded from the JSON export.
- Links do not expire; they stop working only when revoked (user decision 2026-11-27: option A, no expiry).

## Done by this decision

The access model and the link mechanism are recorded. #236 implements them.
