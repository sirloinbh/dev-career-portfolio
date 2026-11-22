# Test useLoad and stop inline loaders from looping (#146)

- `useLoad` keeps the latest `load` in a ref, so only `key` drives the fetch effect. An inline loader such as `useLoad('all', () => api.list())` fetches once instead of on every render.
- New `frontend/src/use-load.test.ts` covers: inline loader fetches once; a new key shows loading and ignores the old key's late answer; a rejected load gives the error state; `useReloading` keeps data when a reload fails; `useReloading` applies a change at once even when the reload fails.
- Verification: `npm run check` (results in the PR).
