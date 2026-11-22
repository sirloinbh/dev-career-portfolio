# Report a malformed id in the address (#141)

- The card asked for string ids, but since ADR-0025 (`setInt8Parser`, be99e80) the API sends numeric ids, so `id: number` stays (user decision via the coordinator, 2026-11-22). Only the invalid-address part is done.
- New `frontend/src/entity-id.ts`: `isValidId` uses the same pattern as the backend `ID_PATTERN`.
- The six edit pages, the cover letter questions page and the questions form show "This address is not valid." for a malformed id, instead of "not found" or a request to the API. The "Edit questions" link is hidden then.
- Edit pages send the loaded row's id instead of `Number(id)`; the path builders for questions take `number | string`, so no `/applications/NaN/...` link is built.
- Tests: `/certifications/abc/edit`, `/applications/abc`, `/applications/abc/questions/edit`.
- Verification: `npm run check` (DB integration tests skip locally: no PostgreSQL; they run in CI).
