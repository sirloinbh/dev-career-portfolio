# #37 Per-company cover letter question storage API and table

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/37>

## Purpose

Build the table and API that store the cover letter questions and answers that differ for each application company (#36). All decisions are the recommended ones and are recorded in an [issue comment](https://github.com/sirloinbh/dev-career-portfolio/issues/37#issuecomment-6657541128).

## Changes

- `database/migrations/008_cover_letter_questions.sql`: the `cover_letter_questions` table. When an application company is deleted, its questions are deleted too (`ON DELETE CASCADE`).
- `backend/src/routes/cover-letter-questions.ts`: `GET` and `PUT /api/applications/:id/questions`, `DELETE /api/applications/:id/questions/:questionId`.
- `backend/src/app.ts`: registered the question routes.
- `backend/test/helpers.ts`: `lockApplications`. Integration tests that empty the applications take turns with a PostgreSQL advisory lock.
- `backend/test/applications.integration.test.ts`: uses the lock above.
- `backend/test/cover-letter-questions.test.ts`: input validation without a DB. `backend/test/cover-letter-questions.integration.test.ts`: `career_test` DB integration.

## API

| Item         | Name        | Rule                                                                                                                          |
| ------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Question ID  | `id`        | Send it only for an already stored question. Leave it empty for a new question. If the same ID appears twice in one list, 400 |
| Question     | `question`  | Required, up to 500 characters, leading and trailing spaces removed                                                           |
| Answer       | `answer`    | Optional, up to 5000 characters. An empty value is `null`                                                                     |
| Length limit | `charLimit` | Optional, an integer from 1 to 5000. `null` if absent. An answer over the limit is still stored                               |

- `GET` returns `{ "questions": [...] }` in display order.
- The body of `PUT` is `{ "questions": [...] }` with at most 10 items.
  - The list order is the display order.
  - An existing question not in the list is deleted, one with an `id` is updated, and one without is created.
  - The whole thing is handled in one transaction. It returns the stored list as it is.
- `DELETE` deletes one question and returns 204.
- Error responses:

| Status | Case                                                                                                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | A field error. A question field error is prefixed with which question it is, as in "2번째 문항: 문항을(를) 입력해 주세요" (Question 2: enter the question)                       |
| 404    | "지원 기업을 찾을 수 없습니다" (Application company not found), "자기소개서 문항을 찾을 수 없습니다" (Cover letter question not found) (including a question of another company) |
| 409    | When `PUT` has the `id` of a question of another company or one deleted in the meantime. Nothing is changed                                                                      |

## Decisions

- **The list is saved at once.** On the screen (#51) the user adds, deletes, and reorders questions and then saves once, so one request is handled in one transaction to prevent only part of it being saved.
- **The count and length follow the body limit.** 10 answers of 5000 characters are about 150 KB in Korean. That fits within the server's JSON body limit of 256 KB. The first recommendation of "answers of 10000 characters, 20 questions" could exceed this limit, so I reduced it.
- **The DB blocks duplicate order within a company.** The check is done at commit time (`DEFERRABLE INITIALLY DEFERRED`), so one save can swap the positions of two questions.
- **Only changed questions get a new `updated_at`.** Saving the same list again does not touch the rows. This becomes the basis when version history is added later.
- **Concurrent saves:** both the `PUT` that changes questions and the single `DELETE` first lock the application company row with `FOR UPDATE`. If a list save, a question delete, and a company delete overlap for the same company, they are handled one after another. So a single `DELETE` also returns 404 "지원 기업을 찾을 수 없습니다" (Application company not found) if the target company does not exist.
- **The number of questions in the delete confirmation dialog** (#49) does not get a separate field. The screen counts it with the question list API.
- **Integration test lock:** the test files run at the same time in several processes. If the application test runs `DELETE FROM applications`, it also deletes the data of the question test. So the two files take the same advisory lock.
- **Migration number:** reserved `008`.

## Verification

Checked on the PostgreSQL 17 (`postgres:17-alpine`) started with Docker on this PC.

- Applying `001` to `008` to `career_test` in order: all exit code 0. Applying `008` once more printed only the notice `relation "cover_letter_questions" already exists, skipping`.
- `npm run check` with `TEST_DATABASE_URL` set to `career_test`: passed (exit code 0).
  - Backend: 86 passed and 0 skipped.
  - The new tests are 6 unit tests and 2 DB integration tests.
  - Frontend: 166 passed and 2 skipped (the existing theme-conditional tests). Skill check: 4 passed.
- `npm run knip`: passed.
- What the integration tests check:
  - Separation per company.
  - An empty answer or no limit is `null`, and an answer over the limit is also stored.
  - One save can swap the order, update, delete, and add. Saving the same list again leaves `updated_at` unchanged.
  - If a question containing a NUL character fails, the earlier updates and deletes are all rolled back.
  - A question ID of another company is 409, and both companies stay as they are.
  - One question can be deleted, and through another company's path it is 404.
  - Deleting a company also removes its questions. A company that does not exist is 404.
  - DB constraints (empty question, limit 0 and 5001, negative order, duplicate order) are checked.

On the first run, 1 existing test failed with `fetch failed: bad port`, and it passed when run again. It is unrelated to this change. It happens when the port the test server gets from `listen(0)` is a port that fetch blocks (for example 6000). It is split into a separate issue.

## Limits

The screens are built in #50 (list) and #51 (writing). How characters are counted (including spaces) and the warning for going over the limit are implemented in #51.

## CI result of the first commit

- `8e3a30e`: CI `verify` (applying the migration twice, backend 86 passed and 0 skipped), `docker-build`, and CodeQL all passed. The 2 e2e tests were skipped because they are off by default.

## First review applied

| Finding                                                                                                                                                                                                                                                                              | Applied                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Medium) The single `DELETE` does not lock the application company row, so it can step in during a `PUT`. After `PUT` checks that a question exists, if that question is deleted, `UPDATE` affects 0 rows, and `PUT` returns 200 while the update the user saved silently disappears | The single `DELETE` also locks the application company row first inside the transaction. I added `FOR UPDATE` to the existing-question lookup in `PUT` too. I added an integration test that checks `DELETE` waits while another connection holds the lock on the application company row. I also confirmed that this test fails on the code before the fix |
| (Low) The document's "if a save and a delete overlap they are handled one after another" does not match the case above                                                                                                                                                               | The fix makes the explanation true, and I also wrote down that the single `DELETE` takes the lock                                                                                                                                                                                                                                                           |

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 87 passed and 0 skipped (3 DB integration tests). Frontend: 166 passed and 2 skipped. `npm run knip`: passed.

## Second review result

It checked that the first-round fix is correct. It checked that there is no risk of a deadlock, and that the new test fails on the code before the fix and is not unstable after it. It also checked the final whole diff and the document again. There were no defects.

1 low finding was applied. There was no test for the 404 "지원 기업을 찾을 수 없습니다" (Application company not found) returned when deleting a question through a path of a company that does not exist, so I added it to the integration test. Reviews are at most 2, so there is no third review. No issue was split off in this review. #77 was split off during the first verification.
