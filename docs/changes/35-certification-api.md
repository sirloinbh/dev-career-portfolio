# #35 Certification storage API and table

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/35>

## Purpose

Build the table that stores certifications and the list, create, update, and delete API. It follows the backend structure settled in #31. The input fields were confirmed with the user and recorded in an [issue comment](https://github.com/sirloinbh/dev-career-portfolio/issues/35#issuecomment-6648234876). All decisions are the recommended ones.

## Changes

- `database/migrations/006_certifications.sql`: the `certifications` table. DB constraints also block an empty certification name, an empty issuer, and an expiry date earlier than the acquired date.
- `backend/src/routes/certifications.ts`: `GET` and `POST /api/certifications`, `PUT` and `DELETE /api/certifications/:id`.
- `backend/src/app.ts`: registered the certification routes.
- `backend/test/certifications.test.ts`: input validation and passing NULL without a DB. `backend/test/certifications.integration.test.ts`: `career_test` DB integration.

## API

| Item               | Name           | Rule                                                                                            |
| ------------------ | -------------- | ----------------------------------------------------------------------------------------------- |
| Certification name | `name`         | Required, up to 100 characters, leading and trailing spaces removed                             |
| Issuer             | `issuer`       | Required, up to 100 characters, leading and trailing spaces removed                             |
| Acquired date      | `acquiredDate` | Required, `YYYY-MM-DD`                                                                          |
| Expiry date        | `expiryDate`   | Optional, `YYYY-MM-DD`. `null` if absent. It cannot be earlier than the acquired date           |
| Score or grade     | `score`        | Optional, up to 50 characters of text (`905 points`, `Grade 1`, `IH`). An empty value is `null` |
| Memo               | `memo`         | Optional, up to 2000 characters. An empty value is `null`                                       |

- Responses are `{ "certifications": [...] }` and `{ "certification": {...} }`. Create returns 201, delete returns 204, and a missing target is 404 "자격증을 찾을 수 없습니다" (Certification not found).
- If the expiry date is earlier than the acquired date, it is 400 "만료일은 취득일보다 빠를 수 없습니다" (The expiry date cannot be earlier than the acquired date). The same day is accepted.
- The list is newest acquired date first, and for the same acquired date the one registered later is on top.

## Decisions

- **No expiry date means NULL.** It is not replaced with an arbitrary date such as `9999-12-31`. Sending `null` in an update makes it NULL again.
- **An expiry date already in the past is also stored.** An expired certification is still part of the history, so it is not rejected. How to mark expiry is settled on screen #46.
- **Score or grade is text.** Each exam has a different format (score, level, grade), so it is not taken as a number.
- **Duplicates are not blocked.** Records of taking the same exam several times can all be kept.
- **It is not linked to the `cert-manager` app.** It does not depend on another app's DB or API, and the data is entered directly in this app.
- **Migration number:** reserved `006`.

## Verification

- `npm test -w backend`: 54 of 68 passed and 14 skipped. This PC has no PostgreSQL, so the DB integration tests (including the 2 new ones) were skipped, and are confirmed by CI `verify`, which uses the `career_test` DB. All 9 new unit tests passed.
  - Reject before the query with 400: an expiry date earlier than the acquired date (create and update), a bad date (only its own error is shown), a missing acquired date, a blank, missing, or 101-character certification name or issuer, a numeric score or a 51-character score, a 2001-character memo, a body that is not an object, and a bad id.
  - A missing expiry date, an empty score, and an empty memo are passed to the query as `null`, and an expiry date on the same day and clearing with `null` are accepted.
- What the integration tests check: a row with no expiry date is stored as NULL in the DB, registering the same name twice is allowed (including rows whose values are all the same), an expiry date on the same day is allowed, the sort (newest acquired date first, the later registration on top for the same day), updating all columns and clearing the expiry date, a 400 for the expiry date order, the original row staying after an update the DB rejected (a NUL character), delete, 404, and DB constraints (empty name, empty issuer, period).
- `npm run check`: passed (exit code 0). The backend is as above, the frontend had 87 passed and 2 skipped (the existing theme-conditional tests), the skill check had 4 passed, and the build passed. `npm run knip` could not load the `oxc-resolver` native module on this PC (see the #58 record), so it is confirmed in CI `verify`.
- Applying the migration twice: I could not run it on this PC. CI `verify` applies all migrations twice with `ON_ERROR_STOP`, so it is confirmed by that result.

## Limits

This PC cannot use Docker (BIOS virtualization is off), so I could not check running Compose. The screens are built in #46 (list) and #47 (create, update, delete).

## CI result of the first commit

- CI `verify` (54d2648): it applied all migrations twice, and the second time `006_certifications.sql` printed only the notice `relation "certifications" already exists, skipping` (no error). Backend: 68 passed and 0 skipped (including 2 `career_test` DB integration tests), knip passed, and `docker-build` and CodeQL passed.

## First review applied

There were no high or medium findings, and all 3 low findings were applied.

| Finding                                                                                                                                                 | Applied                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| The two TOEIC rows in the duplicate-allowed test differ in date and score, so the test would pass even if a unique constraint on name + date came later | Register a row whose values are all the same twice and check that both are 201                                                   |
| The change record said it checks blank, missing, and 101-character values for both the certification name and the issuer, but only some existed         | Added the missing certification name and blank issuer cases                                                                      |
| The check "the original row stays after a rejected update" is a rejection by pre-query validation, so it cannot fail                                    | Changed it to an update the DB rejects (a NUL character in the memo → 400) and check that the original row is unchanged after it |

- `npm run check`: passed (exit code 0). Backend: 54 of 68 passed and 14 skipped (DB integration tests). Frontend: 87 passed and 2 skipped. The changed integration test is confirmed in `career_test` in CI `verify`.
- CI `verify` (4d9e0f1): applying the migration twice had no error, backend 68 passed and 0 skipped (including the changed `career_test` DB integration tests). `docker-build` and CodeQL passed.

## Second review result

It confirmed that all 3 first-round findings were applied (registering the same row twice with the sort and count, the added input validation cases, and that a NUL character really reaches PostgreSQL and is rejected), and it also checked the final whole diff and the explanations in this document. There are no new findings. No issue was split off.
