# #781 Ids come straight from the database as numbers

dev-career-portfolio already sent number ids on the wire (each route cast `id::text` and converted back with `Number`). Following ADR-0025 (project-standards #692, #781) it now relies on the shared checked int8 parser instead.

## Change

- `backend/src/app.ts`: `setInt8Parser(types)` from the managed `standard/db.ts`; a BIGINT above 2^53 throws instead of rounding.
- The seven route files drop `id::text AS id`, the `toApplication`/`toCareer`/... mappers, and the comments about the text output column. Row types use `id: number`.
- Two unit-test fakes return number ids like the database now does.

## Contract

No change on the wire: responses and `parseId` path ids were already numbers, so the frontend is unchanged.

## Checks

- `npm run typecheck`, `lint`, `format:check`: pass.
- Backend: 102 pass, 0 skipped against a local PostgreSQL 17 with all migrations (`career_test`); 83 pass without a database.
- Frontend: 329 pass, 3 skipped.
- Merging is a production deploy.
