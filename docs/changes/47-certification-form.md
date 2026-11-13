# #47 Certification create, update, and delete screens

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/47> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Let the user add, edit, and delete certifications from the #46 list. The structure is the same as the #41 career form. The form state, the splitting of server messages, and the delete handling use the shared code (`form-state.tsx`, `field-errors.ts`, `delete-item.ts`) as it is. The input fields are the ones confirmed in #35.

## Changes

- `frontend/src/app.tsx`: the routes `/certifications/new` and `/certifications/:id/edit`, and `certificationPaths`.
- `frontend/src/certification-data.ts`:
  - The form type and the empty form
  - Conversion between the stored value and the form value (`toCertificationForm`, `toCertificationInput`)
  - `certificationFieldErrors`, which splits server messages per field
  - The `create`, `update`, and `remove` API
- `frontend/src/certifications.tsx`:
  - Added an "자격증 추가" (Add certification) button to the list, "수정" (Edit) and "삭제" (Delete) buttons on each item, and a delete confirmation dialog.
  - Added `NewCertification`, `EditCertification`, and the shared input form `CertificationFields`.
  - Changed the list to `useReloading`, so the remaining items stay on screen even while the list reloads after a delete.
- `frontend/src/certification-form.test.tsx`: create, showing a server message and focus, update, clearing the expiry date, updating an item that does not exist, delete cancel, confirm, failure, and already deleted, partly typed dates, the structure for keyboard use (the basic input fields are in screen order and the form has a submit button), the message mapping table, and value conversion (16 tests). The real Tab and Enter input was done in the browser check below.

## Input form

| Field              | Input                                                           | Notes                                                                                                          |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Certification name | Text, up to 100 characters                                      | Required                                                                                                       |
| Issuer             | Text, up to 100 characters                                      | Required                                                                                                       |
| Acquired date      | Date                                                            | Required                                                                                                       |
| Expiry date        | Date                                                            | If empty it is sent as `null` and the list shows "만료 없음" (No expiry). The same guidance is under the field |
| Score or grade     | Text, up to 50 characters (for example 905 points, Grade 1, IH) | Optional                                                                                                       |
| Memo               | Multiple lines, up to 2000 characters                           | Optional                                                                                                       |

## Decisions

- **The server does the validation.** The form is `noValidate`, and the Korean message the server returns shows under the field the message points to. If several fields are wrong, focus moves to the topmost field. A message that points to no field shows in the notice below the form, and focus returns to the save button (the #39 structure).
- **A partly typed expiry date is not saved as "no expiry".** The browser reads a partly typed date such as "2027-03-__" as an empty value. So, like the end date of the career form, it sends `incomplete`, and the server's date format message shows under the expiry date field.
- **The edit screen finds the item in the list.** #35 has no single-item lookup API. The number of items is small, so it finds it the same way as the other item forms.
- **Delete:** if you cancel in the confirmation dialog, no request is sent. An item that is already deleted (404) is treated as deleted. The guidance text and the 404 handling are the shared behavior of `delete-item.ts`. Moving focus to the page title after a delete is done in the list screen (`certifications.tsx`), the same as the career list.

## Verification

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` is `career_test` on the Docker PostgreSQL 17 on this PC.
  - Backend: 87 passed and 0 skipped.
  - Frontend: 190 passed and 2 skipped (the existing theme-conditional tests). It includes the new form tests.
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- **Real browser:**
  - I drove the installed Chrome (headless 156) through the DevTools protocol.
  - I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17. At first I put in only 1 made-up certification (TOEIC).
  - I did the input with key input events. I typed text, moved between fields with Tab, used digit and arrow keys in the date fields, and saved with Enter.
  - The results "after a reload" were checked against the list the server returned when the list page was opened again.

| What I checked                                                                 | Result                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The empty create form (390×844 light)                                          | No horizontal overflow, smallest text 14px ([picture](47-certification-form/form-new-390-light.png))                                                                                                                                                                                                                                                |
| Type an expiry date earlier than the acquired date by keyboard and press Enter | The server message "만료일은 취득일보다 빠를 수 없습니다" (The expiry date cannot be earlier than the acquired date) shows under the expiry date field and focus goes to the expiry date. No horizontal overflow ([picture](47-certification-form/form-error-390-light.png))                                                                        |
| Clear the expiry date by keyboard and press Enter                              | It returned to the list, "정보보안기사" (Engineer Information Security) shows, and it remains in the list opened again. "만료 없음" (No expiry) is shown ([picture](47-certification-form/list-390-light.png))                                                                                                                                      |
| In the edit screen (1440×900 dark), type a score or grade and press Enter      | Opening the edit screen has the stored values filled in (the picture is before the score or grade was typed, [picture](47-certification-form/form-edit-1440-dark.png)). After saving, the list opened again shows "한국인터넷진흥원 · 필기 합격 후 실기 합격" (Korea Internet & Security Agency · passed the written exam, then the practical exam) |
| The delete confirmation dialog (390×844 light)                                 | The title and the name of the item to delete are shown ([picture](47-certification-form/delete-dialog-390-light.png))                                                                                                                                                                                                                               |
| Cancel with Esc in the dialog                                                  | It remains as it is in the list opened again                                                                                                                                                                                                                                                                                                        |
| Delete in the dialog                                                           | It is gone from the list opened again and only TOEIC remains                                                                                                                                                                                                                                                                                        |

## Limits

There is no editing directly in the list (inline editing). As with the other item screens, it moves to the edit screen.

## CI result of the first commit

- `0344e7c`: CI `verify`, `docker-build`, and CodeQL all passed. The 2 e2e tests were skipped because they are off by default.

## First review applied

There was no code defect. The field mapping, the empty value conversion, partly typed dates, and the edit and delete flows are the same as the career form. 4 findings on tests and the document were applied.

| Finding                                                                                                                                                                     | Applied                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Medium) The test "an item that is already deleted (404) is treated as deleted", which the career and education forms have, was missing though the document said it existed | Added the same test. It checks the empty list, the "지웠습니다" (deleted) guidance, and the dialog closing                                                                                                                                                                                                                                               |
| (Low to medium) The keyboard test did not send Tab or Enter, and the order check only looked at whether it is after the first field                                         | This repository has no `user-event` package that imitates key input. So I changed the test to check only the preconditions for keyboard use: that the basic input fields sit in screen order next to each other, and that a `type="submit"` button is in the form after the last field. The real Tab and Enter input is kept as the browser check result |
| (Low) It described moving focus to the title after a delete as `delete-item.ts` behavior                                                                                    | Fixed it to say that moving focus is done in the list screen                                                                                                                                                                                                                                                                                             |
| (Low) The edit screen picture is before the score or grade is typed, but the table said "the form with the saved values filled in"                                          | Fixed to "Opening the edit screen has the stored values filled in (a picture before input)". The saved result was checked by the text of the list opened again                                                                                                                                                                                           |

- After applying it, `npm run check` (`career_test`): passed. Backend: 87 passed and 0 skipped. Frontend: 191 passed and 2 skipped (16 form tests). Skill check: 4. Build: passed.

## Second review result

There was no defect. The review checked that the tests applied in the first round really catch a breakage.

- If the reload of the list after a 404 delete was removed, the 404 test failed.
- If the submit button was moved outside the form, the keyboard structure test failed.

The final diff, the document, and the 5 pictures also matched each other. Reviews end at 2. No issue was split off.
