# Export and import interviews (#273)

#270 added the `interviews` table and #269 added export and import, and they merged without each other. The import `TRUNCATE` failed with "cannot truncate a table referenced in a foreign key constraint", and the schema test found a table that was neither exported nor skipped.

| File                                  | Change                                                           |
| ------------------------------------- | ---------------------------------------------------------------- |
| `backend/src/routes/data.ts`          | `interviews` joins `dataTables`, after `applications`            |
| `docs/data-format.md`                 | The file shape and the kept links list `interviews`              |
| `backend/test/data-transfer*.test.ts` | The seed has an interview row and the order test covers the link |
