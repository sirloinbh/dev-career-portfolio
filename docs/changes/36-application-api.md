# #36 Job application (company) storage API and table

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/36>

## Purpose

Before managing cover letters per company, build the table that stores the companies a cover letter belongs to, and the list, create, update, and delete API. It follows the backend structure settled in #31. The input fields were confirmed with the user and recorded in an [issue comment](https://github.com/sirloinbh/dev-career-portfolio/issues/36#issuecomment-6650724502). All decisions are the recommended ones.

## Changes

- `database/migrations/007_applications.sql`: the `applications` table. DB constraints also block an empty company name, a status outside the 3 values, and a posting link that is not http(s).
- `backend/src/routes/applications.ts`: `GET` and `POST /api/applications`, `PUT` and `DELETE /api/applications/:id`.
- `backend/src/app.ts`: registered the application routes.
- `backend/test/applications.test.ts`: input validation and passing NULL without a DB. `backend/test/applications.integration.test.ts`: `career_test` DB integration.

## API

| Item                 | Name          | Rule                                                                                                                                     |
| -------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Company name         | `companyName` | Required, up to 100 characters, leading and trailing spaces removed. If empty, 400 "기업명을(를) 입력해 주세요" (Enter the company name) |
| Position applied for | `position`    | Optional, up to 100 characters. An empty value is `null`                                                                                 |
| Job posting link     | `postingUrl`  | Optional, only `http://` and `https://` addresses, up to 500 characters, no whitespace (the same rule as the project link)               |
| Deadline             | `deadline`    | Optional, `YYYY-MM-DD`. `null` if absent. A past date is also accepted                                                                   |
| Application status   | `status`      | Required. `drafting` (drafting), `submitted` (submitted), `closed` (closed)                                                              |
| Memo                 | `memo`        | Optional, up to 2000 characters. An empty value is `null`                                                                                |

- Responses are `{ "applications": [...] }` and `{ "application": {...} }`. Create returns 201, delete returns 204, and a missing target is 404 "지원 기업을 찾을 수 없습니다" (Application company not found).
- The list is ordered by status (drafting → submitted → closed) → nearest deadline first (none last) → the one registered later on top.

## Decisions

- **The name is `applications`.** One row is "one application to one position at one company", and an application to a different position or at a different time at the same company is a separate row. If it were called `companies`, which means the company itself, the same company appearing in several rows would feel odd, so I chose the application-level name. On screen it is called "지원 기업" (application company). The cover letter questions in #37 belong to this row.
- **Duplicates are not blocked.** Applications with the same company name and position are each stored.
- **A past deadline is also stored.** It is a record of a past application, so it is not rejected.
- **The posting link uses the same `optionalLink` as the project link.** Only http(s) is accepted so an address such as `javascript:` is not opened from the screen.
- **Migration number:** reserved `007`.

## Verification

Checked on the PostgreSQL 17 started with Docker on this PC.

- Applying `007_applications.sql` twice each to `career` and `career_test`: all exit code 0. The second time had only the notice `relation "applications" already exists, skipping`.
- `npm test -w backend` with `TEST_DATABASE_URL` set to `career_test`: all 78 passed and 0 skipped. The new tests are 8 unit tests and 2 DB integration tests.
  - Unit: reject before the query with 400 a blank, whitespace-only, missing, `null`, or 101-character company name; a status outside the 3 values (including a case difference such as `Drafting`); a posting link that is not http(s) or contains whitespace; a bad or empty deadline; a 101-character position; a 2001-character memo; a body that is not an object; and a bad id. Update uses the same validation. Empty optional fields and a missing deadline are passed to the query as `null`.
  - Integration: a row with no deadline is stored as NULL in the DB, registering the same company and position twice is allowed, a past deadline is stored, the sort (status → nearest deadline first, none last → most recently registered), dates come back exactly as `YYYY-MM-DD` (including a past deadline), updating all columns and clearing the link and deadline, changing the deadline by update, the original row staying after an update the DB rejected (a NUL character), delete, 404, and DB constraints (empty company name, status, posting link).
- `npm run check` (with the same `career_test`): passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 87 passed and 2 skipped (the existing theme-conditional tests). Skill check: 4 passed. Build: passed.
- `npm run knip`: passed.

## Limits

The screens are built in #48 (list) and #49 (create, update, delete). How cover letter questions are handled when a company is deleted is settled in #37.

## CI result of the first commit

- CI `verify` (3062824): applying the migration twice had no error, backend 78 passed and 0 skipped, and knip passed. `docker-build` and CodeQL passed.

## First review applied

There were no findings on correctness, regressions, or security, and 1 low finding was applied.

| Finding                                                                                                                                                               | Applied                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The integration test never checked a deadline value that is not `null`, so it would pass even if the date shifted by time zone or a past deadline were stored as NULL | Check the past deadline (`2025-01-10`) and the future deadline (`2026-03-01`) in the create response, and check changing the deadline to `2026-04-15` by update |

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 87 passed and 2 skipped.
- CI `verify` (82badf9): backend 78 passed and 0 skipped, and applying the migration twice had no error. `docker-build` and CodeQL passed.

## Second review result

It confirmed that the first-round finding was applied. It also checked that the added update request does not break the later count, NUL, and 404 checks, and checked the final whole diff and the explanations in this document. There were no defects. There was 1 comment finding: a test comment said "a deadline can be added or moved", but the test only checks moving it, so I fixed the comment. Reviews are at most 2, so there is no third review. No issue was split off.
