# #34 Skill storage API and table

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/34>

## Purpose

Build the table that stores skills and the list, create, update, and delete API. It follows the backend structure settled in #31. The input fields were confirmed with the user and recorded in an [issue comment](https://github.com/sirloinbh/dev-career-portfolio/issues/34#issuecomment-6646592220). For proficiency, instead of the issue's recommendation (3 levels: high, medium, low), the user chose 5 levels scored 1 to 5.

## Changes

- `database/migrations/005_skills.sql`: the `skills` table. DB constraints also block the category, the proficiency range, and duplicate skill names (case-insensitive).
- `backend/src/routes/skills.ts`: `GET` and `POST /api/skills`, `PUT` and `DELETE /api/skills/:id`.
- `backend/src/app.ts`: registered the skill routes.
- `backend/test/skills.test.ts`: input validation and the 409 conversion without a DB. `backend/test/skills.integration.test.ts`: `career_test` DB integration.

## API

| Item        | Name          | Rule                                                                                                                                                                     |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skill name  | `name`        | Required, up to 50 characters, leading and trailing spaces removed. Case-insensitive, and only one in total regardless of category                                       |
| Category    | `category`    | Required. `language` (language), `framework` (framework and library), `database` (database), `infrastructure` (infrastructure and cloud), `tool` (tool), `other` (other) |
| Proficiency | `proficiency` | Required, an integer from 1 to 5 (a JSON number). The wording of the criteria for each level is settled on screen #45                                                    |
| Memo        | `memo`        | Optional, up to 2000 characters                                                                                                                                          |

- Responses are `{ "skills": [...] }` and `{ "skill": {...} }`. Create returns 201, delete returns 204, and a missing target is 404 "스킬을 찾을 수 없습니다" (Skill not found).
- Registering an existing name, or changing another skill to that name, is 409 "이미 등록된 스킬입니다" (The skill is already registered). An update that only changes the case of its own name (`TypeScript` → `typescript`) is accepted.
- The list is ordered by category (the order in the table above) → higher proficiency first → skill name (case-insensitive).
- An empty memo is stored as `null`.

## Decisions

- **The DB decides duplicates.** If the server looks up first to check, two requests that arrive at the same time can both pass. It leaves this to the unique index `skills_name_unique` on `lower(name)`, and turns only that violation (23505) into "이미 등록된 스킬입니다" (The skill is already registered). Other unique constraint violations keep the shared handler's "이미 등록된 항목입니다" (The item is already registered).
- **Proficiency accepts only JSON numbers.** It does not turn a string such as `"3"` into a number, so the value is checked as sent, like the other items. The integer and range are checked at once, so the error message appears only once. The DB uses `smallint` and `CHECK (proficiency BETWEEN 1 AND 5)`.
- **The name sort is `lower(name) COLLATE "C"`.** It is fixed so the sort does not vary with the DB locale. It is byte order, so digits and symbols (`.NET`, `C#`, `1Password`) come first, then Latin letters, then Korean. Korean syllable characters are in Unicode order, which is alphabetical order, so they come in alphabetical order (accented Latin letters come after `z`). Names are unique case-insensitively, so there is no case where the order ties.
- **The category is one of 6 fixed values.** Free input is not accepted, so the same category does not split by a spelling difference on the list-by-category screen (#44).
- **Migration number:** reserved `005`.

## Verification

- `npm test -w backend`: 45 of 57 passed and 12 skipped. This PC has no PostgreSQL, so the DB integration tests (including the 2 new ones) were skipped, and are confirmed by CI `verify`, which uses the `career_test` DB. All 9 new unit tests passed.
  - Reject before the query with 400: a blank, missing, or 51-character skill name; a category outside the 6 values (including a case difference such as `Language`); proficiency 0, 6, 2.5, -1, `1e16`, `-1e16`, `"3"`, `null`, or missing; a 2001-character memo; a body that is not an object; and a bad id.
  - A `skills_name_unique` violation is 409 "이미 등록된 스킬입니다" (The skill is already registered) for both create and update, and another unique constraint violation is "이미 등록된 항목입니다" (The item is already registered).
- What the integration tests check: the sort (category → proficiency → case-insensitive name), duplicate 409 even with a different case or category, 409 when changing to another skill's name, allowing a case-only change of its own name, updating all columns, registering the same name again after a delete, 404, and DB constraints (empty name, category, proficiency, duplicate name).
- `npm run check`: passed (exit code 0). The backend is as above, the frontend had 87 passed and 2 skipped (the existing theme-conditional tests), the skill check had 4 passed, and the build passed. `npm run knip` could not load the `oxc-resolver` native module on this PC (see the #58 record), so it is confirmed in CI `verify`.
- Applying the migration twice: I could not run it on this PC. CI `verify` applies all migrations twice with `ON_ERROR_STOP`, so it is confirmed by that result.

## Limits

This PC cannot use Docker (BIOS virtualization is off), so I could not check running Compose. The screens are built in #44 (list by category) and #45 (create, update, delete).

## CI result of the first commit

- CI `verify` (1f4cfd2): it applied all migrations twice, and the second time `005_skills.sql` printed only the notices `relation "skills" already exists, skipping` and `relation "skills_name_unique" already exists, skipping` (no error). Backend: 57 passed and 0 skipped (including 2 `career_test` DB integration tests), knip passed, and `docker-build` passed.

## First review applied

| Finding                                                                                                                                                                                                                                           | Applied                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| (Low) For a proficiency beyond the safe integer range (`1e16`), `.int()` and `.max()` both fail, so the message appears twice, like "숙련도는 1~5 사이의 정수여야 합니다, 숙련도는 …" (proficiency must be an integer from 1 to 5, proficiency …) | Changed to check the integer and the range at once. Added `1e16` and `-1e16` to the rejection list (confirmed failing before the fix) |
| (Low) The change record and the PR body still listed the DB integration tests and applying the migration twice as waiting for CI                                                                                                                  | Recorded in "CI result of the first commit" above                                                                                     |
| (Low) The integration test comment says "that row stays as it is", but it does not check it, and the requested values equal the original, so a change would go unnoticed                                                                          | Request a different category, proficiency, and memo, and after the 409 read again and check that the row equals the original          |
| (Note) The explanation "Latin letters first" is inaccurate (digits and symbols come earlier, and accented Latin letters come after `z`)                                                                                                           | Fixed the Decisions section                                                                                                           |

Verification of the first fix round (`npm run check` passed, exit code 0):

- `npm test -w backend` before the fix: 1 proficiency test failed (the same message twice at `1e16`). After the fix: 45 of 57 passed and 12 skipped (this PC has no PostgreSQL, so the DB integration tests were skipped, and are confirmed by CI `verify`).
- `npm run typecheck`, `npm run lint`, and the Prettier check passed.

## Second review result

The result was that there were no findings. All 4 first-round findings were applied correctly.

- Proficiency: with zod 4.6.7, 0, 6, 2.5, ±`1e16`, `-0`, ±`1e400` (Infinity), `"NaN"`, `"3"`, `null`, `true`, `[]`, `{}`, and missing are all rejected with one Korean message, and 1, 5, `3.0`, and `1e0` pass as numbers.
- The integration test that reads again after the 409 and compares uses the same `GET /api/skills` response on both sides, so it cannot fail by mistake because of field order or format.
- CI `verify` (8cd3b1a): applying the migration twice had no error, backend 57 passed and 0 skipped (including the DB integration tests), and `docker-build` passed.

Reviews are at most 2, so no further review is done. No issue was split off. This commit only added records (the Prettier check passed).
