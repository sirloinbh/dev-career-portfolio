# #221 Show item counts and upcoming deadlines on the dashboard

## Decision (user, 2026-11-27)

Deadlines in the next 14 days (today included); certifications expiring in the next 90 days. Recorded on the issue.

## Change

| File                                                                | Change                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/routes/dashboard.ts`                                   | New read-only `GET /api/dashboard`: counts per section, drafting applications due within 14 days, certifications expiring within 90 days (the expiry day itself counts as valid; past dates are left out), and the 5 most recently changed rows across the six tables. "Today" is the service date (`Asia/Seoul`) injected like the applications list |
| `backend/src/app.ts`, `backend/src/openapi.ts`, `docs/openapi.json` | Route registered and documented                                                                                                                                                                                                                                                                                                                       |
| `frontend/src/dashboard.tsx`, `dashboard-data.ts`                   | Summary cards with links, one empty message per card, error alert; replaces the "No features yet" empty state                                                                                                                                                                                                                                         |
| `frontend/src/app.tsx`                                              | The Dashboard route renders `DashboardScreen`                                                                                                                                                                                                                                                                                                         |
| `frontend/src/app.test.tsx`                                         | Its fakes now answer `/api/dashboard` with an empty summary                                                                                                                                                                                                                                                                                           |

Every table already has `updated_at` and each update route sets it, so no migration was needed.

## Tests

- `backend/test/dashboard.test.ts`: read-only queries, service date and windows passed to the queries.
- `backend/test/dashboard.integration.test.ts`: counts; deadline edges (past, today, day 14, day 15, submitted, none); expiry edges (past, today, day 90, day 91, none); recent order. Runs in a rolled-back transaction under table locks. **Skipped locally (no PostgreSQL); CI is the DB proof.**
- `frontend/src/dashboard.test.tsx`: cards and links, countdown text, empty messages, failed load.
- Browser check (mock API + vite, Chrome via Playwright): 390x844 and 1440x900 show the cards, no "No features yet", no horizontal scroll.
