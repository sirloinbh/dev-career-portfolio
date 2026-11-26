# Export and import file format

Settings can download every record as one JSON file (`GET /api/data/export`) and restore the app from such a file (`POST /api/data/import`). User decision 2026-11-27 (#222): an import **replaces all data in one transaction after a confirmation step**; any error leaves the data unchanged; there is no merging.

## Shape

```json
{
  "format": "dev-career-portfolio-export",
  "version": 1,
  "exportedAt": "2026-11-27T01:02:03.000Z",
  "tables": {
    "app_settings": [],
    "educations": [{ "id": 1, "school": "...", "created_at": "2026-01-01T00:00:00+00:00" }],
    "careers": [],
    "projects": [],
    "skills": [],
    "certifications": [],
    "applications": [],
    "cover_letter_questions": []
  }
}
```

- `format` and `version` identify the file. A file with another format or version is refused. A change to the columns or their meaning needs a new `version`.
- `tables` has one key per table, in the order a table comes after the tables it points to. Each value is a list of rows. A row is an object whose keys are the database column names (`snake_case`) and whose values are the stored values: text, numbers, `true`/`false`, `null`, lists of text (`projects.technologies`), dates as `YYYY-MM-DD`, timestamps as ISO 8601 text. Ids and links (`projects.career_id`, `cover_letter_questions.application_id`) are kept as they are, so links survive the round trip.
- Text is UTF-8 JSON, so Korean text survives unchanged.

## What is not in the file

- `audit_log` (history of tool calls) and `schema_migrations` (the migration runner's own table).
- Attachments: not stored yet. The attachments issue decides how they are backed up.

## Import rules

1. The file is parsed and checked with Zod first: format, version, that every table is a list of rows, and that every row is an object. Then each row's keys must be exactly the table's columns (no unknown, none missing).
2. One transaction empties every table (`TRUNCATE ... RESTART IDENTITY`), inserts the rows (the database's own constraints still apply), and moves each id sequence past the highest imported id. Any error, including a row the database refuses, rolls the whole transaction back.
3. The request body limit for this one route is 20 MB (other routes: 256 kB).

## Adding a table

`dataTables` in `backend/src/routes/data.ts` lists the exported tables in dependency order. A new table must be added there (or to `skippedTables`); the integration test fails until it is. Changing columns of an existing table keeps `version` 1 readable only for files that have the new columns, so bump `version` when old files must still be accepted.

## Backups

`scripts/backup.ps1` and `deploy/backup.sh` still take `pg_dump` backups of the whole database. The JSON file is for moving data between machines and for restoring without a terminal.
