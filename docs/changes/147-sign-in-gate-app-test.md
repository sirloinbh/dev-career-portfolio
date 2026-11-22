# App-level tests for the sign-in gate (#147)

- `app.test.tsx` now stubs the location to `career.daysofme.com` and answers `/api/me` and `/api/health` by path (any other request throws), so `SignInGate` is really in play in jsdom.
- New tests: signed-out (checking state, then redirect to `https://auth.daysofme.com/sign-in?returnTo=...`, no app shown), signed-in (dashboard, account name, sign-out link) and a failed session check (alert with "Try again").
- Test-only change; no production code touched.
- Verification: `npm run test -w frontend -- src/app.test.tsx` (7 passed) and `npm run check`.
