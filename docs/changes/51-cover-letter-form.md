# Write, reorder, and delete cover letter questions on screen (#51)

Issue: [#51](https://github.com/sirloinbh/dev-career-portfolio/issues/51) (parent issue #68, applications and cover letters)

Note: test and fixture data are made-up Korean company names, questions, and answers, quoted as they appear on screen.

## Purpose

The #50 page only showed an application's questions. This change adds a form for writing questions and answers, putting them in order, and removing them. It saves them with the #37 API, which takes the whole list at once. It also adds the question count to the application delete dialog.

## Changes

- `frontend/src/cover-letter-form.tsx` (new): `EditQuestions` at `/applications/:id/questions/edit`.
  - Each question is a card with Question (up to 500 characters), Character limit (blank means none), and Answer (up to 5000 characters).
  - Under the answer, a live count: "N / L characters". Over the limit it turns red and adds "· M over the limit. It can still be saved."
  - "Up", "Down", and "Remove" per card, and "Add question" (up to 10, with "N of 10 questions" under it).
  - "Save" sends the whole list in screen order; "Cancel" goes back to the view without saving.
- `frontend/src/cover-letter-data.ts`: `QuestionDraft`, `toDraft`, `toQuestionsInput`, `typedLimit`, `questionFieldErrors`, `maxQuestions`, and `coverLetterApi.save`.
- `frontend/src/cover-letter-questions.tsx`: an "Edit questions" link on the view page. The empty state now points to it.
- `frontend/src/applications.tsx`: the delete dialog counts the application's questions when it opens (`DeleteApplication`).
- `frontend/src/application-data.ts`, `frontend/src/app.tsx`: `ApplicationPaths.editQuestions` and the route.
- `frontend/src/cover-letter-form.test.tsx` (new): 15 tests (12 at the first commit).
  - Open from the view, the loaded values, and save in order.
  - Add (focus moves to the new question), move (focus stays with the question), and remove (Cancel, Remove, focus to Add question, nothing deleted before saving).
  - The live count and saving over the limit.
  - Server messages under the right question's field, a failed save that keeps the content, a 409 below the form, the 10-question cap, an empty list, and a missing application.
  - The conversion and message-mapping rules.
- `frontend/src/application-form.test.tsx`: the fake API answers the question list. There are 2 new tests for the delete dialog count (3 questions, none, and a failed count).

## Decisions

- **A separate form page, saved all at once.** The #37 API saves the whole list in one transaction, so the form edits a copy of the list and Save sends it. A failed save changes nothing on the server, and the screen keeps what was typed.
- **Removing a question asks first, and only leaves the list.** The dialog says "Nothing is deleted until you save." Cancel on the form page drops every change. Deleting one question right away while other edits wait would mix two kinds of saving.
- **The order on screen is the saved order.** "Up" and "Down" buttons move a question, rather than dragging, so a keyboard works the same as a mouse. After a move, focus stays on the moved question's button (the other one when it reaches the top or bottom). After a remove, focus goes to "Add question".
- **Character limit over the limit: warn, still save** (#37 decision). The count includes spaces and line breaks (the #50 rule). The warning is red text plus words, and it is tied to the answer field (`aria-describedby`).
  - A limit the server would refuse (0, 5001, 1.5, letters) counts without a limit on screen. On save it is sent as it is, so the server's message appears under that field.
- **Server messages go under the question they name.** The server names a question by its position ("Question 2: Question is required"). The form remembers the order it sent, so a message finds its question by a key that stays with the question. A message about the whole list ("Questions can have at most 10 items", a 409 from another tab) is shown below the form.
- **The delete dialog count** (#37 decided the screen counts with the question API): the dialog asks for the list when it opens.
  - It says "and its 3 cover letter questions will be deleted", or "It has no cover letter questions".
  - Until the count arrives, or if it cannot be read, it says "and its cover letter questions will be deleted" without a number.
- **Save status:** while saving, the button shows a spinner and "Saving" for screen readers. Success shows "Saved the questions" and returns to the view. Failure shows the reason: a message about a field goes under it and gets focus, and any other goes below the form and focus returns to Save.

## Verification

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` pointed at `career_test` on a throwaway Docker PostgreSQL 17 with `database/migrations` applied.
  - Backend: 89 passed and 0 skipped.
  - Frontend: 254 passed and 2 skipped (the existing theme-conditional tests). It includes the 14 new tests of the first commit.
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- **Real browser:**
  - I drove the installed Chrome (headless 157) through the DevTools protocol.
  - The dev servers (API 3108 started with `tsx src/server.ts`, Vite 5208) pointed at the same `career_test`.
  - The data was 1 made-up application, "구름데이터", with 2 saved questions. The check day was 2026-11-17.
  - Buttons were pressed with Enter on the focused button, and text was typed into the focused field.
  - The failed save was made by failing the `PUT` request in the browser (DevTools `Fetch.failRequest`, as a lost connection).
  - The pictures are full-page captures, so the sticky header can sit in the middle of a tall picture.

| What I checked                                                                               | Result                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Edit questions" on the view (390×844 light)                                                 | `/applications/<id>/questions/edit` with the title "Edit questions: 구름데이터" and both questions filled in. No horizontal overflow, smallest text 14px ([picture](51-cover-letter-form/form-390-light.png))                                               |
| "Add question" with Enter, then type the question, Tab, limit 40, Tab, a 56-character answer | Focus went Question → Character limit → Answer. The count reads "56 / 40 characters · 16 over the limit. It can still be saved." in red ([picture](51-cover-letter-form/form-over-limit-390-light.png))                                                     |
| "Up" on question 3                                                                           | It became question 2, and focus stayed on its "Up"                                                                                                                                                                                                          |
| "Remove" on question 3 ("협업 경험"), Esc, then "Remove" again and confirm                   | The dialog says "'협업 경험' and its answer leave the list. Nothing is deleted until you save." Esc kept it; Remove took it out, and focus went to "Add question" ([picture](51-cover-letter-form/remove-dialog-390-light.png))                             |
| Save while the request fails                                                                 | "Cannot reach the server" below the form, still on the form, every field as typed ([picture](51-cover-letter-form/save-failed-390-light.png))                                                                                                               |
| Save again                                                                                   | It returned to the view. After a reload (1440×900 dark): "지원 동기" then "입사 후 포부", the latter "56 / 40 characters · 16 over the limit" ([view](51-cover-letter-form/view-after-save-1440-dark.png), [form](51-cover-letter-form/form-1440-dark.png)) |
| "Delete" on the application in the list                                                      | "'구름데이터' and its 2 cover letter questions will be deleted. This cannot be undone." ([picture](51-cover-letter-form/delete-count-390-light.png))                                                                                                        |

## Limits

- Leaving the form with unsaved changes (back link, Cancel, another menu) does not ask first. The other item forms do not either.
- Question order is changed one step at a time. With at most 10 questions, that is a few presses at most.
- After a 409 (another tab changed the questions), saving again fails the same way. The message says to reload the list, and reloading drops what was typed here. Copy long answers out first.
- The answer box stops at 5000 UTF-16 units, the same unit the server's cap uses, so an answer full of emoji stops before 5000 characters on the count.

## Review

- Round 1 (PR #112): no bugs. Applied in one commit with tests:
  - The delete dialog ignores a count from an earlier opening, so a slow answer cannot overwrite the latest.
  - The question fields are locked (`fieldset disabled`) while saving, so nothing typed after Save is lost when the page moves on.
  - Going over a limit, or back under it, is announced once in a polite live region ("Over the character limit: question 2. It can still be saved."). The count under the answer still updates on every key without being read out.
  - The remove dialog quotes the first 60 characters of a long question.
  - This record: the failure focus wording and the test counts.
  - Not changed: the 409 retry (now under Limits); the answer box limit (under Limits); "Question N: Invalid question ID" naming no field, which this form cannot cause.
  - After the fixes, `npm run check` passed again (backend 89 passed / 0 skipped, frontend 257 passed / 2 skipped), and the browser flow ran again with the same results.
- Round 2: the round 1 fixes are correct (focus after a failed save, the dialog triggers inside the locked fieldset, the stale-count guard). No new findings. Two small follow-ups applied: closing the delete dialog no longer clears the count during its fade-out, and the live-region test name now says what it checks (the text, which only changes with the over-limit set).
