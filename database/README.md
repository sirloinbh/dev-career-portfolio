# Dev Career Portfolio PostgreSQL

PostgreSQL 17. The only source of migrations is `migrations/NNN_<description>.sql`. On an empty Docker volume, all files are applied automatically in name order on the first run, and CI applies all files in order too.

For an existing DB, apply a new migration directly from the file mounted in the container.

```powershell
docker compose exec -T db psql -U career -d career -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/NNN_<description>.sql
```

Do not pipe the file through PowerShell, as in `Get-Content … | docker compose exec … psql`. Windows PowerShell 5.1 sends ASCII to external programs, so Korean text turns into `?`.

Rules: write every migration so it is safe to run again. Parallel branches reserve a number when they start. Preserve the meaning of existing data, and leave values you could not confirm as NULL. For Korean literals in SQL, use `U&'\\XXXX'` escapes when possible.
