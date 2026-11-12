# #33 Project storage API and table

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/33>

## Purpose

Build the table that stores projects and the list, create, update, and delete API. It follows the backend structure settled in #31. The input fields were confirmed as recommended and recorded in an [issue comment](https://github.com/sirloinbh/dev-career-portfolio/issues/33#issuecomment-6618198926).

## Changes

- `database/migrations/004_projects.sql`: the `projects` table. DB constraints also block a wrong period order, more than 30 technologies, and a bad link format.
- `backend/src/routes/projects.ts`: `GET` and `POST /api/projects`, `PUT` and `DELETE /api/projects/:id`.
- `backend/src/routes/shared.ts`: the link validation helper `optionalLink`. Later certification and activity items use it too.
- `backend/src/app.ts`: registered the project routes.
- `backend/test/projects.test.ts`: input validation without a DB. `backend/test/projects.integration.test.ts`: `career_test` DB integration.

## API

| Item                      | Name            | Rule                                                                                                                                                                                    |
| ------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project name              | `name`          | Required, up to 100 characters, leading and trailing spaces removed                                                                                                                     |
| Organization              | `organization`  | Optional, up to 100 characters. Typed as text, not linked to a career                                                                                                                   |
| Start date                | `startDate`     | Required, `YYYY-MM-DD`                                                                                                                                                                  |
| End date                  | `endDate`       | Optional. Empty (`null`) means in progress. It cannot be earlier than the start date                                                                                                    |
| Role                      | `role`          | Optional, up to 100 characters                                                                                                                                                          |
| Summary                   | `summary`       | Optional, up to 500 characters                                                                                                                                                          |
| Contributions and results | `contributions` | Optional, up to 2000 characters                                                                                                                                                         |
| Technologies              | `technologies`  | A list of strings, default `[]`. Up to 50 characters per item and at most 30 items. Leading and trailing spaces removed, and empty items and duplicates (case-insensitive) are rejected |
| Repository link           | `repositoryUrl` | Optional, up to 500 characters, only `http://` and `https://` addresses, no whitespace characters                                                                                       |
| Service link              | `serviceUrl`    | Optional, up to 500 characters, only `http://` and `https://` addresses, no whitespace characters                                                                                       |

- Responses are `{ "projects": [...] }` and `{ "project": {...} }`. Create returns 201, delete returns 204, and a missing target is 404 "프로젝트를 찾을 수 없습니다" (Project not found).
- The list is newest start date first, and for the same day the one registered later comes first.
- An empty optional field is stored as `null`. Technologies keep the input order as it is.

## Decisions

- **Links accept only http(s).** The value is opened as a link on screen, so both the server and the DB block addresses such as `javascript:` and `file:`. If there is a space, tab, or line break, the server rejects it with "공백을 넣을 수 없습니다" (spaces are not allowed). It checks, by the same rule as the DB constraint, whether the original text starts with `http://` or `https://` (case-insensitive), and then parses it with Node's `URL`. It also rejects an `https://` with no host. The DB constraint is also case-insensitive (`~*`), so the DB does not reject an `HTTPS://…` that the server accepted with a 500.
- **Technologies are a `text[]`.** Since they are not linked to skill items (an issue decision), they are kept as a list in one column instead of a separate table. The screen shows them in order, so the input order is kept.
- **Sorting:** as found in #32, `ORDER BY` uses `projects.id` so ids compare as numbers. The integration test sets the id sequence to 8 to check the case that crosses 9 → 10.
- **Migration number:** reserved `004`.

## Verification

- `npm run check`: passed. Backend: 46 passed and 0 skipped (`career_test` on a temporary PostgreSQL 17, including the DB integration tests). Frontend: 86 passed and 2 skipped (the existing theme-conditional tests).
- `npm run knip`: passed.
- Applying `004_projects.sql` twice: the second time had only the `already exists, skipping` notice and no error.

## First review applied

| Finding                                                                                                                                                                                                                 | Applied                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| (Medium) `URL` reads `https:example.com`, `https:/example.com`, and `https:\\example.com` as `https://example.com/` and lets them pass, and the DB constraint rejects the original text, leaving a 500 instead of a 400 | `optionalLink` checks the original `http(s)://` prefix directly. Added the three addresses to the unit test's rejection list                    |
| (Low) `URL` silently removes tabs and line breaks, so the stored original differs from the address that actually opens                                                                                                  | Reject addresses with whitespace characters (store the input as it is, without normalizing). Added tab, line break, and space cases to the test |
| (Low) The change record's statement that "the DB never rejects with a 500" was wrong                                                                                                                                    | Fixed the explanation in the Decisions section above                                                                                            |

Verification of the first fix round:

- `npm run check`: passed. This PC has no PostgreSQL, so the backend had 36 of 46 passed and 10 skipped (DB integration tests), and the frontend had 86 passed and 2 skipped. The DB integration tests are confirmed by the CI `verify` result, which uses the `career_test` DB.
- The changed behavior is checked by the link rejection list in `projects.test.ts`, which runs without a DB.
- CI `verify` (62be063): backend 46 passed and 0 skipped (including the `career_test` DB integration tests).

## Second review applied

All 3 first-round findings were resolved, and the result was that no more input passes the server validation but hits a DB constraint with a 500. I also confirmed that valid addresses (uppercase `HTTP://`, a Korean domain, `user:pw@`) are not rejected by mistake.

| Finding                                                                                                                                           | Applied                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Low) When it rejected `https://example.com/my file` with a space, it said "the address must start with http:// or https://", which was confusing | Added a separate whitespace check and the message "저장소 링크에는 공백을 넣을 수 없습니다" (no spaces are allowed in the repository link). Checked tab, line break, space, and full-width space (U+3000) cases with tests |
| (Note) A control character such as `\u0001` is removed by `URL`, so the original and the address that opens can differ                            | No action, since it happens only when written directly in JSON and does not cause a 500                                                                                                                                    |

Reviews are at most 2, so no further review is done after the second round of fixes. No issue was split off.

- Leading and trailing spaces are still removed with `trim()` before the check. So the whitespace rejection tests use cases with a space in the middle of the address (`a　b`, `my file`, and so on).
- I changed the invalid link example in the update request test from `not a link` to `not-a-link`. With a space, the whitespace message now comes first, so this matches the original intent of checking the prefix message.

Verification of the second fix round:

- `npm run check`: passed (exit code 0). This PC has no PostgreSQL, so the backend had 36 of 46 passed and 10 skipped (DB integration tests). The DB integration tests are confirmed by CI `verify`.
- Frontend `npm test -w frontend`: ran separately 8 times; 7 times gave 86 passed and 2 skipped, and only the first run had 1 failure. This change does not touch the frontend and it did not reproduce in the next 7 runs, so I treat it as a one-off failure. I could not identify which test it was.

## Limits

This PC cannot use Docker (BIOS virtualization is off), so I could not check running Compose. The Docker image build is confirmed by the CI result. The screens are built in #42 (list) and #43 (create, update, delete).
