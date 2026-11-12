# #32 Career (work history) storage API and table

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/32>

## Purpose

Build the table that stores career (work history) and the list, create, update, and delete API. It follows the backend structure settled in #31. The input fields were confirmed as recommended and recorded in an [issue comment](https://github.com/sirloinbh/dev-career-portfolio/issues/32#issuecomment-6617988778).

## Changes

- `database/migrations/003_careers.sql`: the `careers` table. DB constraints also block a row whose end date is earlier than its start date and an employment type outside the list.
- `backend/src/routes/careers.ts`: `GET` and `POST /api/careers`, `PUT` and `DELETE /api/careers/:id`.
- `backend/src/app.ts`: registered the career routes.
- `backend/test/careers.test.ts`: input validation without a DB. `backend/test/careers.integration.test.ts`: `career_test` DB integration.

## API

| Item            | Name             | Rule                                                                                                                  |
| --------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Company name    | `company`        | Required, up to 100 characters, leading and trailing spaces removed                                                   |
| Department      | `department`     | Optional, up to 100 characters                                                                                        |
| Position        | `position`       | Optional, up to 100 characters                                                                                        |
| Employment type | `employmentType` | Required. `full_time` (full-time), `contract` (contract), `intern` (intern), `freelance` (freelance), `other` (other) |
| Start date      | `startDate`      | Required, `YYYY-MM-DD`                                                                                                |
| End date        | `endDate`        | Optional. Empty (`null`) means currently employed. It cannot be earlier than the start date                           |
| Duties          | `duties`         | Optional, up to 2000 characters                                                                                       |
| Achievements    | `achievements`   | Optional, up to 2000 characters                                                                                       |

- Responses are `{ "careers": [...] }` and `{ "career": {...} }`. Create returns 201, delete returns 204, and a missing target is 404 "이력을 찾을 수 없습니다" (Career not found).
- The list is newest start date first, and for the same day the one registered later comes first.
- An empty optional field is stored as `null`, not an empty string.

## Decisions

- **I did not add a status field.** Unlike education, a career has only "currently employed" and "left", so whether the end date is empty is enough. With a field, a contradiction such as "currently employed but has an end date" would need a separate block.
- **A department move or a promotion is a separate career entry** (an issue decision). A structure that groups several periods within one company is handled in a new issue when it is really needed.
- **Migration number:** reserved `003`. The remaining API cards (#33 to #37) use the next numbers in the order they start.

## First automatic review

There was no blocking defect, and the four suggestions to strengthen the tests were applied in an additional commit.

| Suggestion                                                                                                                  | Action                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| The update (PUT) test checked only two fields, so it would pass even if a field dropped out of SET or `$8` and `$9` swapped | Send every field changed and compare the whole response                 |
| It did not check that all five employment types are saved to the DB                                                         | Added an integration test that registers all five                       |
| It did not check that the later entry comes first for the same start date                                                   | Check the order of five entries on the same day                         |
| End date = start date is allowed, and the message when the employment type is missing                                       | Register a one-day row, and check the Korean message when it is missing |

## Second automatic review (final)

One defect came up and was fixed in an additional commit. Reviews are at most 2, so there is no third review.

| Finding                                                                                                                                                                                                                                                                                                                              | Action                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Sorting by the same start date compared ids as text. The `id` in `ORDER BY ... id DESC` pointed to the response's `id::text AS id`, giving the order 9, 11, 10. The test strengthened in the first round failed in CI, which uses a fresh DB (ids 7 to 11), and passed on the local temporary DB because all its ids were two digits | Name the table column with `careers.id`. The test sets the id sequence to 8 so it crosses 9 → 10 on any DB       |
| The same problem exists in the already merged education API (`educations.ts`)                                                                                                                                                                                                                                                        | It is a one-line fix, so fix it in this PR too, and add the same-day sort case to the education integration test |

Suggestions not applied: tests for the length limits of `company`, `department`, and `duties`, and comparing an omitted end date with `null` in PUT. They use the same `requiredText` and `optionalText` helpers and behavior already verified in education, so I did not add them.

## Verification

- `npm run check`: passed. Backend: 36 passed and 0 skipped (`career_test` on a temporary PostgreSQL 17, including the DB integration tests). Frontend: 86 passed and 2 skipped (the existing theme-conditional tests).
- `npm run knip`: passed.
- Applying `003_careers.sql` twice: the second time had only the `already exists, skipping` notice and no error.

## Limits

This PC cannot use Docker (BIOS virtualization is off), so I could not check running Compose. The Docker image build is confirmed by the CI result. The screens are built in #40 (list) and #41 (create, update, delete).
