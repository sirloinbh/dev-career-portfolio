# Show one application's cover letter questions (#50)

Issue: [#50](https://github.com/sirloinbh/dev-career-portfolio/issues/50) (parent issue #68, applications and cover letters)

Note: test and fixture data are made-up Korean company names, questions, and answers, quoted as they appear on screen.

## Purpose

Questions differ per company, so each application needs its own page for its cover letter questions and answers. This change adds a read-only page on the #37 API. Writing questions is #51.

## Changes

- `frontend/src/cover-letter-data.ts` (new): the `CoverLetterQuestion` type, `coverLetterApi.list`, and the display rules `answerLength` and `answerLengthText`.
- `frontend/src/cover-letter-questions.tsx` (new): the `ApplicationQuestions` page at `/applications/:id`.
  - The title is the company name, with a summary line under it: status badge, position, and deadline text.
  - The questions are shown as a numbered list in API order, each with its answer (line breaks kept) and its answer length.
  - It has loading (`SkeletonList`, an `sr-only` status, `aria-busy`), empty (`EmptyState`), not found (404), and error (`Notice`) states.
- `frontend/src/applications.tsx`: each list row gets a "Questions" link (`aria-label` "Cover letter questions for <company>"). The status badge style moved to `application-data.ts` (`applicationStatusVariant`), so both pages share it.
- `frontend/src/application-data.ts`: `ApplicationPaths.questions` and `applicationStatusVariant`.
- `frontend/src/app.tsx`: the route and `applicationPaths.questions`.
- `frontend/src/cover-letter-questions.test.tsx` (new): 9 tests.
  - The list link, the order, and the numbers, answers, and lengths.
  - The application summary, and that a second application shows only its own questions.
  - The empty, not found, server error, offline, and loading states.
  - The length rules.

## Decisions

- **Address `/applications/:id`.** The page is about one application, and the form already uses `/applications/:id/edit`. `/applications/new` is a fixed path, so it does not clash.
- **One application's questions only.** The questions are loaded by the id in the address (`useLoad` keyed by it). Moving to another application loads again, so the earlier questions are never kept on screen. The API also only returns questions whose `application_id` matches.
- **Saved order.** The API returns `display_order` order (#37), and the page keeps it. The number "Question N" is the position, not the database id.
- **Answer length counts every character, spaces and line breaks included** (#37 decision). It counts by code point, so an emoji is one character.
  - With a limit, it shows "N / L characters".
  - Over the limit, it adds "· M over the limit". #37 stores such an answer, and the screen is where it is pointed out.
  - #51 can reuse the same rule for its counter.
- **The application summary comes from the list API.** There is no single-item API (#36). If the questions request is a 404, the page says the application is not found and keeps a general title.
- **No edit buttons yet.** Writing, reordering, and deleting questions, and the question count in the application delete dialog, are #51.

## Verification

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` pointed at `career_test` on a throwaway Docker PostgreSQL 17 with `database/migrations` applied.
  - Backend: 89 passed and 0 skipped.
  - Frontend: 239 passed and 2 skipped (the existing theme-conditional tests). It includes the 9 new tests.
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- **Real browser:**
  - I drove the installed Chrome (headless 157) through the DevTools protocol.
  - The dev servers (API 3108 started with `tsx src/server.ts`, Vite 5208) pointed at the same `career_test`.
  - The data was 2 made-up applications. "구름데이터" had 3 questions saved through `PUT /api/applications/:id/questions`: one answer with a line break and a limit of 500, one without an answer, and one 527-character answer with a limit of 300. "바다물류" had none.
  - The check day was 2026-11-17.

| What I checked                | Result                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The list (390×844 light)      | Each row has "Questions", "Edit", and "Delete". No horizontal overflow, smallest text 14px ([picture](50-cover-letter-questions/list-390-light.png))                                                                                                                                                                                                     |
| "Questions" on "구름데이터"   | `/applications/<id>` opens with the title "구름데이터" and the 3 questions in saved order. The lengths are "28 / 500 characters", "0 characters", and "527 / 300 characters · 227 over the limit". The line break in the first answer is kept. No horizontal overflow, smallest text 14px ([picture](50-cover-letter-questions/questions-390-light.png)) |
| "바다물류" opened right after | The title is "바다물류" and no question of "구름데이터" shows. "No questions yet" is shown ([picture](50-cover-letter-questions/empty-390-light.png))                                                                                                                                                                                                    |
| "구름데이터" opened again     | The same 3 questions in the same order                                                                                                                                                                                                                                                                                                                   |
| An id that does not exist     | "Application not found. It may already be deleted."                                                                                                                                                                                                                                                                                                      |
| 1440×900 dark                 | No horizontal overflow, smallest text 14px ([picture](50-cover-letter-questions/questions-1440-dark.png))                                                                                                                                                                                                                                                |

## Limits

- The over-limit note is plain text in the muted colour. A stronger warning while typing belongs to the #51 form.
