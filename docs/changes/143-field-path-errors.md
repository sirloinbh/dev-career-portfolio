# Place form errors by field path (#143)

- `backend/src/app.ts` registers `createErrorHandler({ fields: true })`, so a validation 400 also carries `fields: [{ path, message }]` (project-standards#799). The `error` sentence is unchanged. The test that checked the exact 400 body in `backend/test/health.test.ts` now expects `fields`. (Ownership exception from the coordinator: only this registration and the tests it breaks.)
- `useServerForm(fieldOf, { conflictField })` in `form-state.tsx` places each message by path, focuses the first placed field in page order (from the DOM, no order table), and shows messages with no field (an empty path, an unknown path, a 400 without `fields`) in the notice. A 409 goes under `conflictField` (the skill name) when the form sets it.
- `flatFieldOf(emptyForm)` maps a path (`company`, `technologies.3`) to the form field; cover letter questions map `questions.<index>.<field>` to the question's key through the keys of the list as it was sent.
- Deleted `frontend/src/field-errors.ts`, every `fieldLabels` and `formOrder` table, and the tests of the splitting. Form tests now send the structured body (`test/server-errors.ts`).
- Behavior change: a validation list longer than 10 no longer shows "and N more" under a field (the count is not part of `fields`).
- Verification: `npm run check` (DB integration tests skip locally; CI runs them).
