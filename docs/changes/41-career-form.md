# #41 Career (work history) create, update, and delete screens

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/41> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Create, update, and delete career entries from the screen. It has the same structure as the #39 education input form. So that the forms of the remaining items (projects, skills, certifications) use the same code, I pulled the shared parts that were inside the education form out into modules.

## Changes

- `frontend/src/careers.tsx`: an "이력 추가" (Add career) button on the list, edit and delete for each item, `NewCareer`, `EditCareer`, and the input form `CareerFields`. The list now uses `useReloading`, which keeps the rows after a delete.
- `frontend/src/career-data.ts`: the form state type and conversions (`toCareerForm`, `toCareerInput`), `careerFieldErrors` that splits a server error message per field, and `careerApi.create/update/remove`.
- `frontend/src/app.tsx`: the routes `/careers/new` and `/careers/:id/edit`, and `careerPaths`.
- Shared modules pulled out of the education form (the education screen uses them too. The behavior is the same and the 28 existing education tests still pass as they are):
  - `frontend/src/field-errors.ts`: `splitFieldErrors` splits a server message per field and sorts it in screen order. The education `fieldErrors` only passes the education field names to this function.
  - `frontend/src/form-state.tsx`: `useServerForm` handles the saving state, per-field errors with `aria-invalid` and `aria-describedby`, focus to the topmost field with an error, a message with no field shown in a `Notice` below the form with focus on the save button, and the save and cancel buttons.
  - `frontend/src/delete-item.ts`: `deleteItem` reports the delete result in a toast, treats a row that is already gone (404) as deleted, and keeps the dialog open on any other failure. It attaches the Korean object particle (학력을, 프로젝트를) to match the name.
- `frontend/src/career-form.test.tsx`: checks create, update, delete, and error display with an in-memory fake API (14 tests at first, 15 after the first review).

## Decisions

- **Currently employed:** as decided in #32, an empty end date means currently employed. I did not add a separate "currently employed" checkbox. If the checkbox were cleared and the end date left empty, it would still be saved as currently employed, so the two fields could disagree. Instead, under the end date field I put "지금 다니는 회사면 비워 둡니다. 목록에 "재직 중"으로 보입니다." (Leave it empty if you work there now. It shows as "currently employed" in the list.) and tied it to the field with `aria-describedby`. Clearing the end date in an edit makes it currently employed.
- **The server does the validation (same as #39).** The form is `noValidate`, and the server's Korean message shows under the field. A comma inside the employment type message ("정규직, 계약직, …", a list of types) stays as one message.
- **Input fields:** `maxLength` matches the server limits: 100 characters for company, department, and position, and 2000 for duties and achievements. The employment type is a native `select`, as in education.

## Verification

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 110 passed and 2 skipped (the existing theme-conditional tests, including 14 new career form tests). Skill check: 4 passed. Build: passed. `npm run knip`: passed.
- Real browser: I drove the installed Chrome (headless 156) through the DevTools protocol. I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 on this PC and started with 3 made-up career entries. Every step used only key input (`Tab`, `Enter`, `Escape`, digit and arrow keys), no mouse. I typed the date fields in the order year → right arrow → month → right arrow → day.

Keyboard flow (same result at both 390×844 and 1440×900):

| Step                                                                                    | Result                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On the list, `Tab` to "이력 추가" (Add career) → `Enter`                                | Moved to `/careers/new`                                                                                                                                                                           |
| Enter a company name, start date 2023-03-02, and end date 2020-02-28, then "추가" (Add) | Under the end date field "퇴사일은 입사일보다 빠를 수 없습니다" (The end date cannot be earlier than the start date), `aria-invalid`, focus moved to the end date, and the input values were kept |
| Fix the end date to 2024-01-31 and "추가"                                               | Returned to the list with "이력 4건" (4 career entries), and it stays after a reload                                                                                                              |
| "키보드테스트 수정" (Edit keyboard test) → enter achievements → "저장" (Save) → reload  | The achievements stay saved                                                                                                                                                                       |
| "키보드테스트 삭제" (Delete keyboard test) → dialog → `Escape`                          | The dialog closes, focus returns to the delete button, "이력 4건", and still 4 after a reload                                                                                                     |
| "키보드테스트 삭제" again → "삭제" (Delete) in the dialog → `Enter`                     | "이력 3건", focus on the page title (`h1`), and still 3 after a reload                                                                                                                            |

At both sizes there is no horizontal overflow in the list and in the form with an error, and the smallest visible text is 14px.

| List 390                                 | Form with an error 390                          | Edit form 1440                             | Delete confirmation 390                                          |
| ---------------------------------------- | ----------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| ![List 390](41-career-form/list-390.png) | ![Error 390](41-career-form/form-error-390.png) | ![Edit 1440](41-career-form/form-1440.png) | ![Delete confirmation 390](41-career-form/delete-dialog-390.png) |

## First review applied

A read-only review agent looked at the whole PR diff. It confirmed that moving the education form into shared modules behaves the same (including the grade guidance id, `clearError`, and the toast wording), and it pointed out the following three things. All were fixed in this PR.

- **(Medium) A partially typed end date was saved as currently employed:** if you type only the year and month in a date field (`2023-12-__`), the browser reads the value as `''` and only turns on `validity.badInput`. An empty end date means currently employed, so it was saved without an error. The education graduation date was the same (empty means no graduation date). I added `typedDate` in `form-state.tsx` so that such a field is sent as text the server rejects (`incomplete`), and the server's "퇴사일은(는) YYYY-MM-DD 형식의 날짜여야 합니다" (The end date must be a date in YYYY-MM-DD format) shows under the field. It is used for the career end date and the education graduation date. The start date and admission date are required, so the server already rejects an empty value.
- **(Low) The 404 delete test was weak:** I strengthened it to check that the success toast ("'한빛소프트' 이력을 지웠습니다", The career at 'Hanbit Soft' was deleted) shows and "지우지 못했습니다" (could not delete) does not.
- **(Low) No test for the grade guidance link:** I added a test that checks the grade and scale fields are described by the guidance "학점과 만점은 함께 넣거나 함께 비워 둡니다" (Enter the grade and scale together, or leave both empty).

Verification:

- 3 new tests (career end date, education graduation date, grade guidance). I confirmed that if `typedDate` is changed to return the value as it is, 2 date tests fail, and they pass again when it is reverted.
- Real browser (headless Chrome 156, 390×844): typing only the year and month by keys into the end date and graduation date and pressing "추가" sent it as `value: ''` with `badInput: true`, "퇴사일은(는) YYYY-MM-DD 형식의 날짜여야 합니다" (for education "졸업일은(는) …") showed under the field, and focus went to that field. The row was not saved.
- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed. Backend: 78 passed and 0 skipped. Frontend: 113 passed and 2 skipped. Skill check: 4 passed. Build: passed. `npm run knip`: passed.

## Second review applied

The second review confirmed that the three first-round findings were fixed correctly. The server rejects `incomplete` as a format error (with `abort`, so other errors do not overlap), and the message goes to the end date and graduation date fields. It pointed out two new things, and both were fixed in this PR.

- **(Medium) Choosing enrolled after partly typing the graduation date blocks saving:** enrolled clears and locks the graduation date, but a partly typed field already has the value `''`, so React does not touch the field. The locked field kept reporting `badInput`, so `incomplete` was sent and an error showed under the locked field (reproduced in the real browser: `disabled: true`, `badInput: true`, save rejected). `typedDate` now sends a locked field's value as it is, and choosing enrolled also clears the date field directly.
- **(Low) The number of career form tests in the document:** fixed from 14 to 15.

Verification:

- 1 new test (partly typed graduation date → enrolled → saved with `endDate: null`). It fails if the locked field check is removed, and passes when it is restored.
- Real browser (headless Chrome 156, 390×844): typing only the year and month into the graduation date and changing the status to enrolled by keyboard empties the field and gives `badInput: false`, and after "추가" it returned to the list and was saved as enrolled with no graduation date. I deleted the row I used for the check.
- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed. Backend: 78 passed and 0 skipped. Frontend: 114 passed and 2 skipped. Skill check: 4 passed. Build: passed. `npm run knip`: passed.
