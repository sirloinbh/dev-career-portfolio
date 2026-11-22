# #152 Adopt the shared query layer on @tanstack/react-query

- Issue: [#152](https://github.com/sirloinbh/dev-career-portfolio/issues/152)
- Branch: `chore/152-install-react-query` (step 1: install)
- Parent: sirloinbh/project-standards#788 (ADR-0027, closed 2026-11-19)

Order, the same as health-log (sirloinbh/health-log#220) and cert-manager (sirloinbh/cert-manager#161): install the package here first, then turn on the `query` feature for this app in project-standards, then merge the sync PR that brings `frontend/src/lib/query.ts`, then move the screens from `useLoad` to the shared layer and delete `use-load.ts`.

## Install the package — 2026-11-22

Add `@tanstack/react-query` 5.104.1 to the `frontend` workspace with the approved command, `npm install --ignore-scripts --save-exact @tanstack/react-query@5.104.1 -w frontend` (user reconfirmed on 2026-11-22, recorded in an issue comment). It brings one dependency, `@tanstack/query-core` 5.104.1 (MIT, no install scripts). npm also moved `@vitejs/plugin-react` into alphabetical order in `frontend/package.json`; the version is unchanged.

The npm workspaces share the one root `package-lock.json`, which the install updated; there is no second lockfile to sync.

### Verification

- `node .standards/ioc-scan.mjs`: `ioc-scan: no suspicious items` (it notes that esbuild and fsevents have install scripts, which do not run with `--ignore-scripts`; all were already in the lockfile).
- `npm audit` from the install: `found 0 vulnerabilities`.
- `npm run check`: passed (frontend 406 passed, 3 skipped; backend DB integration tests skip locally without `TEST_DATABASE_URL` and run in CI).

## Provide a query client — 2026-11-22

CI's `knip` runs in strict mode and failed PR #211 with `Unused dependencies (1) @tanstack/react-query`, because nothing imported the package yet. `App` now provides one `QueryClient` (kept in state, React Query's defaults) through `QueryClientProvider` around the routes, the same step cert-manager took (sirloinbh/cert-manager#161). The synced shared `createQueryClient()` replaces it in step 4.

### Verification

- `npm run knip`: the unused-dependency finding is gone. Locally knip also reports `e2e/smoke.spec.ts` and `@axe-core/playwright` because `playwright.config.ts` needs a test database; that output is the same on `origin/main` and does not happen in CI.
- `npm run check`: passed (frontend 406 passed, 3 skipped).

## Move the screens onto the shared query layer — 2026-11-22

Branch `feat/152-shared-query-layer`. Steps 2 and 3 are done: sirloinbh/project-standards#998 (PR #1000) turned on the `query` feature for this app, and sync PR #212 brought `frontend/src/lib/query.ts` and its test.

- `list-query.ts` (new): a `ListQuery` is an entity list's GET path plus how to take its rows out of the answer. `useListQuery` loads it with `useApiQuery` under `apiKey(path)`; `useRefreshList` invalidates that key after a write.
- Each `*-data.ts` exports its list (`careerList` and the others) instead of an `api.list()` loader; the screens pass it to the shells.
- `ItemListPage` loads through `useListQuery`. A delete hides the row at once (a set of deleted ids, so a failed refetch cannot bring it back), then refreshes the list; Try again calls `refetch`.
- `NewItemPage` (new `listPath` prop) and `EditItemPage` (`list` instead of `loadItems`) refresh the list after a save, before going back to it, so the list never shows the rows from before the save. The Edit screen finds its row in the list screen's cache entry, so coming from the list shows the form without a second request. A malformed id loads nothing (`enabled: false`).
- The cover letter screens load the questions with `useQuestions` (in `cover-letter-data.ts`, keyed by the application's questions path) and the application from `applicationList`; saving the questions refreshes that key. The delete dialog's one-off question count still uses `coverLetterApi.list`.
- `App` now uses the shared `createQueryClient()` (30 s fresh time, one retry for network errors and 5xx, refetch on window focus).
- `use-load.ts` and `use-load.test.ts` are deleted.

Tests: `test/query.tsx` (new) gives a screen rendered without `<App />` a fresh client with retries off, and `serveList` answers one list path. `item-list-page.test.tsx` and `item-form-page.test.tsx` load through it; the malformed-id test also checks that nothing is fetched. `careers.test.tsx`: the failed-refresh test now fails both tries (the shared layer retries a 5xx once), and a new test checks that opening Edit from the list sends no second `GET /api/careers`.

Behaviour change to note: coming back to a list within 30 s shows the cached rows without a request; after 30 s it shows them at once and refreshes in the background.
