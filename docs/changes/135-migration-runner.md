# Migration runner for the deploy script (#135)

- Already on main: the shared runner (`backend/src/standard/migrate.ts`, `migrations.ts`) with checksums, an advisory lock and `--status`; `backend/src/migrate.ts` re-exports it so `node dist/migrate.js` works; `npm run db:migrate` exists; existing databases are baselined by the first run (all files are idempotent, so they are applied again and recorded; `database/README.md`).
- Added runner tests (`backend/test/migrations.test.ts`) with an in-memory connection: apply in order and record, skip applied, checksum mismatch, `--status` without changes, no-history database, and loading the repository's migration files.
- `database/README.md` now states that applied files are never edited; changes go into a new numbered file.
- `npm run build -w backend` produces `backend/dist/migrate.js` (checked). The check "a deploy run reaches the health check" is for after deploy.
