# #39 Education create, update, and delete screens

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/39>

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Create, update, and delete education from the screen. Settle the structure the input forms of the other items will follow.

## Changes

- `frontend/src/app.tsx`: the routes `/educations/new` (add) and `/educations/:id/edit` (edit), and `educationPaths`.
- `frontend/src/educations.tsx`: an "학력 추가" (Add education) button on the list, edit and delete for each item, `NewEducation`, `EditEducation`, and the shared input form `EducationFields`.
- `frontend/src/education-data.ts`: the form state type and conversions (`toEducationForm`, `toEducationInput`), `fieldErrors` that splits a server error message per input field, and `educationApi.create/update/remove`.
- `frontend/src/form-fields.ts`: classes for the native `select` and `textarea`, and number field conversion. It is the same as cert-manager, with an invalid-value border (`aria-invalid`) added.
- `frontend/src/use-load.ts`: brought `useReloading`, which reloads the list after a delete, from cert-manager.
- `frontend/src/education-form.test.tsx`: checks create, update, delete, and error display with an in-memory fake API.

## Input form structure the next items follow

1. Add and edit are pages with their own addresses: `/<plural>/new` and `/<plural>/:id/edit`. After saving, show a notification (toast) and return to the list. The list loads again when it reopens.
2. The form holds every field as an input value string (`<singular>Form`) and converts it with `to<Singular>Input` when sending. An empty optional field is `null`. A number field is a text field with `inputMode="decimal"`, not `type="number"`. A number field turns unreadable text ("3..5") into an empty value, so the server never gets a chance to explain it in Korean.
3. **The server does the validation.** The form turns off browser validation with `noValidate` and shows the server's Korean message as it is. The server joins several messages with ", " into one, so `fieldErrors` splits them by the leading field name (학교명 (school name), 입학일 (admission date), …) and attaches each under its field. A comma inside a message ("고등학교, 전문학사, …", a list of degrees) does not start with a field name, so it stays in the previous message.
4. A field with an error is tied to its message with `aria-invalid` and `aria-describedby`, and focus moves to the topmost field with an error on screen. A message that belongs to no field is shown in a `Notice` (`role="alert"`) below the form, and focus returns to the save button.
5. Delete asks with a `ConfirmDialog` from the button on the list item. A target that is already gone (404) is treated as deleted, and any other failure keeps the dialog open and shows the reason in a toast. After the delete the row disappears, so focus moves to the page title (`h1`, `tabIndex={-1}`).
6. Button names are made distinct per item: `aria-label="<school name> 수정"` (edit) and `"<school name> 삭제"` (delete).
7. There is no single-item lookup API (#31), so the edit page loads the list and finds the row. If it is not there, it shows "찾을 수 없습니다" (Not found).

## Decisions

- **Splitting the error message:** at first the whole message was attached to the first item's field, but during the real browser check, in a run where auto-filling the date fields failed, the format errors of the admission date and the graduation date were attached together under the admission date field. I confirmed that the central `standard/http.ts` joins messages with ", " and fixed it to split per field.
- **Enrolled:** when the status is changed to "재학 중" (enrolled), the graduation date is cleared and locked. This is so the form does not send a value the server would reject.
- **Native `select`:** I used the native `select` like cert-manager instead of the shared `Select` (Radix). The phone's default picker opens, and the keyboard arrows change the value right away.

## First automatic review

The findings were applied in an additional commit.

| Finding                                                                                                                                                                  | Action                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| When a message of another field comes between messages of the same field (a grade decimal error → a scale decimal error → grade > scale), the earlier message disappears | Collect per field so all show, and add a unit test                                            |
| A number field (`type="number"`) turns "3..5" into an empty value so the server cannot explain it. If both are typed wrongly, it is saved with no grade                  | Changed to an `inputMode="decimal"` text field and checked the server message in the browser  |
| The record's line "if all dates are cleared, two date errors" cannot come out of this code (an empty graduation date is `null`)                                          | Changed to a case I really checked (school name and admission date cleared) and checked again |
| (Suggestion) No test for the delete failure and 404 paths                                                                                                                | Added tests                                                                                   |
| (Suggestion) If the id in the edit page address changes, the old form state can remain                                                                                   | `key={id}` on the form                                                                        |
| (Suggestion) If you choose enrolled while a graduation date error exists, the error remains under the locked field                                                       | Choosing enrolled also clears the graduation date error                                       |

Suggestion not applied: a delete failure reason is shown in a toast while the dialog is open, but it is outside the modal, so a screen reader may not read it. It works the same way as cert-manager and I could not check it with a screen reader, so I left it. I did not add a required-field marker (`aria-required`) because it is not in the standard.

## Second automatic review (final)

There was no blocking defect, and two low-level findings and one suggestion were applied in an additional commit.

| Finding                                                                                                                                       | Action                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| If "Infinity" is typed in both grade and scale, JSON sends `null` and it is saved with no grade. "0x4" and "1e1" also become 4 and 10         | `toNumber` converts only plain decimals (`3`, `3.5`, `.5`) to numbers and sends everything else as text. Added unit tests |
| Focus goes to the first field in the order the server sent (with a grade error + a graduation date error, it skips the graduation date above) | `fieldErrors` sorts in screen order and focus goes to the topmost field. Added a test                                     |
| (Suggestion) Focus can disappear from a button that was disabled after an error with no field                                                 | In that case focus returns to the save button. Added a test                                                               |

Suggestions not applied, and why:

- Coupling the field names to the backend wording, and duplicated degree and status lists: this is a problem of the repository structure having no shared contract file (`shared/contract.ts`), so it is outside this PR.
- The "YYYY-MM-DD format" wording for an empty date: it is the #31 backend wording, so it is out of scope.
- Tests for 400 and network errors on the edit page and for double submission: the edit page uses the same `EducationFields` as the add page, so I judged them covered by the add page tests.

## Verification

- `npm run check`: the result is recorded in the PR body.
- Real browser: as in #38, I drove the installed Chrome (headless) through the DevTools protocol. API 3108, Vite 5208, `career_test` on a temporary PostgreSQL 17, and made-up data.

Keyboard flow (passed at both 390×844 and 1440×900):

| Step                                                                                              | Result                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On the list, `Tab` to "학력 추가" (Add education) → `Enter`                                       | Moved to `/educations/new`                                                                                                                                                                                                 |
| Enter a school name, admission date 2019-03-02, and graduation date 2015-02-20, then "추가" (Add) | Under the graduation date field "졸업일은 입학일보다 빠를 수 없습니다" (The graduation date cannot be earlier than the admission date), `aria-invalid`, focus moved to the graduation date, and the input values were kept |
| Clear the school name and admission date, then "추가" (checked again after the first review)      | The school name and admission date errors are shown separately under their own fields, and focus goes to the school name                                                                                                   |
| Enter "3..5" in grade and 4.5 in scale, then "추가" (after the first review)                      | The server message "학점은(는) 숫자여야 합니다" (The grade must be a number) under the grade field, and focus goes to the grade                                                                                            |
| Fix the graduation date, choose master with the degree arrows, grade 4.2 / 4.5, save              | Returned to the list with "학력 1건" (1 education entry), and it stays after a reload                                                                                                                                      |
| "한빛대학교 수정" (Edit Hanbit University) → enter a major → save → reload                        | The major stays changed                                                                                                                                                                                                    |
| "한빛대학교 삭제" (Delete Hanbit University) → dialog → `Escape`                                  | The row stays, focus returns to the delete button, and it stays after a reload                                                                                                                                             |
| "한빛대학교 삭제" → "삭제" (Delete) in the dialog                                                 | An empty list, focus moves to the title "학력" (Education), and it stays empty after a reload                                                                                                                              |

- When the dialog opens, focus goes to "취소" (Cancel) (the shared `ConfirmDialog`).
- 390×844 touch emulation: every input and button in the form is 44px or more, the input text is 16px or more, and there is no horizontal overflow. At 1440×900 the input text is 14px, which is the desktop size of the shared `Input` (`md:text-body-sm`).
- There were no console errors.

Screenshots (made-up data): [form 1440](39-education-form/form-1440.png), [error display 390](39-education-form/form-error-390.png), [delete confirmation 390](39-education-form/delete-dialog-390.png), [list after saving 390](39-education-form/list-390.png), [two field errors 390](39-education-form/form-two-errors-390.png)

## Limits

- **I put the values into the date fields with a script.** The date field of headless Chrome did not accept key input (the digit keys of `Input.dispatchKeyEvent`, and `insertText`). I moved to the date fields with `Tab` and then put in values with input events, and I did all other moving, typing, choosing, saving, and deleting with keyboard events. I could not check typing digits directly into a date field in regular Chrome.
- In phone emulation the date field turns into a picker, so I did the keyboard flow in a 390px window of desktop Chrome. I measured the touch target sizes separately with touch emulation.
- I did not do a real phone, an axe check, or running Docker Compose.
