# #222 Export and import all data as JSON from Settings

## Decision (user, 2026-11-27)

Import replaces all data in one transaction after a confirmation step; any error leaves the data unchanged; no merging. Recorded on the issue.

## Change

| File                                            | Change                                                                                                                                                                                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/routes/data.ts`                    | `GET /api/data/export` (one read-only snapshot of every record table) and `POST /api/data/import` (Zod envelope check, column check, then `TRUNCATE` + insert in one transaction, id sequences reset, constraint errors become a 400 and roll back) |
| `backend/src/app.ts`                            | Registers the routes; the shared 256 kB JSON parser skips the import path, which has its own 20 MB parser after the sign-in check                                                                                                                   |
| `backend/src/openapi.ts`, `docs/openapi.json`   | Two operations                                                                                                                                                                                                                                      |
| `frontend/src/settings.tsx`, `settings-data.ts` | Settings screen: Export button (downloads the file), file picker with a summary, destructive confirmation dialog, status and error notices; lists refetch after an import                                                                           |
| `frontend/src/app.tsx`                          | Settings route renders `SettingsScreen`; the placeholder `Page` helper (no users left, "No features yet") is removed                                                                                                                                |
| `docs/data-format.md`                           | The file format and import rules                                                                                                                                                                                                                    |

## Tests

- `backend/test/data-transfer.test.ts`: refused files never reach the database.
- `backend/test/data-transfer.integration.test.ts`: runs in its own schema (a copy of all migrations), so it can wipe every table without touching the parallel test files. Round trip (export, wipe, import, same rows, Korean text, ids continue), replace-not-merge, broken/wrong-version/unknown-column/missing-column/constraint-violation/dangling-link files change nothing, and a guard that fails when a table is neither exported nor skipped. **Skipped locally (no PostgreSQL); CI is the DB proof.**
- `frontend/src/settings.test.tsx`: export download, import with confirmation, cancel, invalid file, server refusal.
- Browser check (mock API + vite, Chrome via Playwright): 390x844 and 1440x900 show both sections without horizontal scroll; the export produced a real download.
