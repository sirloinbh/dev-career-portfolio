# Dev Career Portfolio PostgreSQL

PostgreSQL 17. The only source of migrations is `migrations/NNN_<description>.sql`. They are applied by the shared runner (`npm run db:migrate`, `backend/src/standard/migrations.ts`), which records each file in `schema_migrations` and applies it in one transaction. CI applies all files with `psql` first and then runs the runner.

On an empty Docker volume, start the database and run the runner:

```powershell
docker compose up -d --wait db
npm run db:migrate
```

`npm run db:migrate -- --status` lists applied and pending files without changing the database. An existing database that was migrated by hand is recorded the first time the runner runs: every file is safe to run again, so it is applied once more and recorded.

Do not pipe the file through PowerShell, as in `Get-Content … | docker compose exec … psql`. Windows PowerShell 5.1 sends ASCII to external programs, so Korean text turns into `?`.

Rules: an applied file is never edited; the runner stores a checksum for each file and refuses to run when one changed. Put a change into a new numbered file. Write every migration so it is safe to run again. Parallel branches reserve a number when they start. Preserve the meaning of existing data, and leave values you could not confirm as NULL. For Korean literals in SQL, use `U&'\\XXXX'` escapes when possible.
