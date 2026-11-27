# #222 follow-up: include interviews in the data export

## Problem

#270 added the `interviews` table while #222 was in review. After both merged, the table guard in `backend/test/data-transfer.integration.test.ts` fails ("a table is neither exported nor listed in skippedTables"), main CI is red, and an import would try to `TRUNCATE applications` without `interviews`, which the database refuses.

## Change

| File                                                                      | Change                                                   |
| ------------------------------------------------------------------------- | -------------------------------------------------------- |
| `backend/src/routes/data.ts`                                              | `interviews` added to `dataTables`, after `applications` |
| `backend/test/data-transfer.test.ts`, `data-transfer.integration.test.ts` | Order check and a seeded interview row in the round trip |
| `docs/data-format.md`                                                     | Table listed in the example                              |

## Tests

`npm run check` (DB integration tests are skipped locally; CI runs them).
