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
