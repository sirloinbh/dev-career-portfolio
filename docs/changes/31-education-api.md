# #31 Education storage API and table

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/31>

## Purpose

Build the table and API that store education history, and settle the backend structure the other portfolio items will follow. The input fields were confirmed as recommended and recorded in an issue comment.

## Changes

- `database/migrations/002_educations.sql`: the `educations` table. DB constraints also block a wrong period order and an out-of-range grade.
- `backend/src/routes/educations.ts`: `GET` and `POST /api/educations`, `PUT` and `DELETE /api/educations/:id`.
- `backend/src/routes/shared.ts`: helpers for date and string input validation that all items share.
- `backend/src/app.ts`: replaced the hand-written error handling with `notFound` and `errorHandler` from the centrally managed file `standard/http.ts`.
- `backend/test/helpers.ts`: `withApi` takes a method and a body. Added `testDatabaseUrl()`.

## Backend structure the next items follow

1. Add the table in `database/migrations/NNN_<plural>.sql`. Leave an unfinished period as NULL.
2. Create `register<Name>Routes(app, pool)` in `backend/src/routes/<plural>.ts` and register it before `notFound` in `app.ts`.
3. Validate input with Zod `parse()` on the first line of the handler. Set the messages in Korean.
4. Wrap responses as `{ "<plural>": [...] }` and `{ "<singular>": {...} }`. Create returns 201 and delete returns 204. A missing target is `HttpError(404, …)`.
5. pg returns `bigint` and `numeric` as strings, so convert them to numbers in the response.
6. Split the tests into input validation without a DB (`<plural>.test.ts`) and real DB integration (`<plural>.integration.test.ts`).

## Request rate limit

In the first PR, CodeQL failed with `js/missing-rate-limiting`. The warning says an API that uses the DB has no Express-level limit, and it does not recognize an nginx limit. The user chose to install a package, and `express-rate-limit@8.7.2` was added. The value is 1200 per minute, the same as the sibling apps, and nginx blocks 10 per second per visitor first. The API does not trust the proxy, so every request through nginx counts as the same address. That means this value is a total limit, not a per-visitor limit, and it stays as it is because the app has a single user. The code is `backend/src/rate-limit.ts` and the test is `backend/test/rate-limit.test.ts`.

## First automatic review

Findings came up and were applied in additional commits.

| Finding                                         | Action                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| Year 0000 ended in a 500                        | Reject it with 400 in `calendarDate`. Later items use this helper too                   |
| A graduation date could be saved while enrolled | Added API validation and the DB constraint `educations_enrolled_open`                   |
| A wrong date also showed an order error         | Added `abort` to the date validation so only that error shows                           |
| The DB allowed a scale above 100                | Added `gpa_scale <= 100` to `educations_gpa_range`                                      |
| The sort test also passed in id order           | Changed it to insert the row with the later start date first                            |
| Missing tests                                   | Added tests for the scale limit, update validation, a NUL character, and DB constraints |

I did not add a test for a broken JSON body. That is the behavior of the centrally managed file `standard/http.ts`, and the reviewer checked the 400 directly. The CodeQL warning is resolved by the request rate limit above.

## Second automatic review

It confirmed the first round's fixes were applied correctly, and 2 findings were applied in an additional commit. Reviews are at most 2, so there is no third review.

| Finding                                                                          | Action                                                                                  |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| The sort test passed even without `ORDER BY` (insert order = id ascending)       | Insert start dates in the order 2019 → 2024 → 2015 and check the order 2024, 2019, 2015 |
| The rate limit was described as a per-visitor limit (it is really a total limit) | Fixed the comment in `rate-limit.ts` and the explanation in this document               |

Out of scope: `deploy/remote-deploy.sh` runs a `dist/migrate.js` that does not exist, and `compose.yaml` applies migrations only on a new volume. Both are centrally managed files and the problems are on main too, so they are not fixed in this PR. The central repository must handle them before the first deploy.

## Decisions

- **Test DB protection:** the user environment variable `TEST_DATABASE_URL` on this PC points to another project's `study_test`. Integration tests delete rows, so they run only when the DB name is `career_test` and are skipped otherwise. The existing baseline tests use the same helper.
- **I did not build a single-item lookup API.** The edit screen can use the list data, so nothing uses it now.

## Verification

The results in `docs/changes/` are also recorded in the PR body.

- `npm run check`: passed.
- `npm test -w backend` with `career_test` on a temporary PostgreSQL 17: passed. The DB integration tests were not skipped.
- Applying `002_educations.sql` twice: no error.

Fix commit for the second review:

- `npm run check`: passed. Backend: 20 of 24 passed and 4 skipped (the DB integration tests were skipped because this PC has no `career_test`). Frontend: 58 passed and 2 skipped (the existing theme-conditional tests).
- The changed sort test is a DB integration test, so I could not run it locally. It is confirmed by the result of `career_test` (PostgreSQL 17) in CI.
- `npm run standards:check`: passed. `npm run knip`: could not run because the `oxc-resolver` native module could not be loaded on this PC. There is no export change, and it runs in CI.

## Limits

This PC cannot use Docker (BIOS virtualization is off), so I could not check running Compose. The Docker image build is confirmed by the CI result. The screens are built in #38 and #39.
