# #43 Project create, update, and delete screens

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/43> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Create, update, and delete projects from the screen. It uses the shared form modules pulled out in #41 (`form-state.tsx`, `field-errors.ts`, `delete-item.ts`) as they are.

## Changes

- `frontend/src/projects.tsx`: a "프로젝트 추가" (Add project) button on the list, edit and delete for each item, `NewProject`, `EditProject`, and the input form `ProjectFields`. The list now uses `useReloading`, which keeps the rows after a delete.
- `frontend/src/project-data.ts`: the form state type and conversions (`toProjectForm`, `toProjectInput`, `splitTechnologies`), `projectFieldErrors` that splits a server error message per field, and `projectApi.create/update/remove`.
- `frontend/src/app.tsx`: the routes `/projects/new` and `/projects/:id/edit`, and `projectPaths`.
- `frontend/src/field-errors.ts`: when the same message comes several times for the same field, it shows only once. The server gives one error per item in a list, so with two technology names over 50 characters, "사용 기술 항목은 50자 이하여야 합니다" (A technology item must be 50 characters or fewer) comes twice.
- `frontend/src/project-form.test.tsx`: checks create, update, delete, and error display with an in-memory fake API (14 tests at first, 17 after the first review).
- `frontend/src/projects.test.tsx`: the list now has an edit link, so the external link check was narrowed to the "new tab" links.

## Decisions

- **In progress:** as decided in #33, an empty end date means in progress. Under the end date field I tied "진행 중인 프로젝트면 비워 둡니다. 목록에 "진행 중"으로 보입니다." (Leave it empty for a project in progress. It shows as "in progress" in the list.) with `aria-describedby`, and a partly typed end date is rejected by the server as a format error, as in #41.
- **Technologies:** a one-line input where you write them separated by commas. An input that adds one tag at a time needs its own keyboard and screen reader behavior, but a one-line input can be used and edited like a normal field. Leading and trailing spaces are removed, and empty pieces made by doubled commas or a trailing comma are dropped. The server checks the 50-character limit, the 30-item limit, and duplicates, and the message shows under the field. A technology with a comma in its name cannot be entered. The server accepts a name with a comma, so a name such as "Node, Inc" entered directly through the API would be split into "Node" and "Inc" if you edit another field on screen and save. Entering only through the screen as now does not produce this, so I leave it as a known limit.
- **Links:** `type="url"` so the phone shows the address keyboard, and I turned off auto-capitalization and spell correction. The server does the format check (`noValidate`). Under the repository link I put "http:// 또는 https://로 시작하는 주소를 넣습니다." (Enter an address that starts with http:// or https://).
- **Input field limits:** `maxLength` matches the server limits: 100 characters for project name, organization, and role, 500 for the summary, 2000 for contributions and results, and 500 for links. The technologies field is 1600 characters so that 30 items of 50 characters and the separators fit.

## Verification

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 140 passed and 2 skipped (the existing theme-conditional tests, including 14 new project form tests). Skill check: 4 passed. Build: passed. `npm run knip`: passed. I also confirmed that the matching test fails if the same-message merging is removed.
- Real browser: I drove the installed Chrome (headless 156) through the DevTools protocol. I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 on this PC and started with 3 made-up projects. Every step used only key input (`Tab`, `Enter`, `Escape`, `Ctrl+A`, letter, digit, and arrow keys), no mouse.

Keyboard flow (same result at both 390×844 and 1440×900):

| Step                                                                                                                                                          | Result                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On the list, `Tab` to "프로젝트 추가" (Add project) → `Enter`                                                                                                 | Moved to `/projects/new`                                                                                                                                                                                                                                      |
| Enter a project name, start date 2024-05-01, technologies "TypeScript, PostgreSQL,", and repository link `github.com/…`, then "추가" (Add)                    | Under the repository link field "저장소 링크은(는) http:// 또는 https://로 시작하는 주소여야 합니다" (The repository link must be an address that starts with http:// or https://), `aria-invalid`, focus moved to that field, and the input values were kept |
| Fix the address with `Ctrl+A` to `https://…` and "추가"                                                                                                       | Returned to the list with "프로젝트 4건" (4 projects), and it stays after a reload. The technologies are the two TypeScript and PostgreSQL, with no trailing comma                                                                                            |
| "키보드프로젝트 수정" (Edit keyboard project) → the technologies field is "TypeScript, PostgreSQL" → enter contributions and results → "저장" (Save) → reload | The contributions and results stay saved                                                                                                                                                                                                                      |
| "키보드프로젝트 삭제" (Delete keyboard project) → dialog → `Escape`                                                                                           | The dialog closes, focus returns to the delete button, "프로젝트 4건", and still 4 after a reload                                                                                                                                                             |
| "키보드프로젝트 삭제" again → "삭제" (Delete) in the dialog → `Enter`                                                                                         | "프로젝트 3건", focus on the page title (`h1`), and still 3 after a reload                                                                                                                                                                                    |

At both sizes there is no horizontal overflow in the list and in the form with an error, and the smallest visible text is 14px.

| List 390                                  | Form with an error 390                           | Edit form 1440                              | Delete confirmation 390                                           |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------- |
| ![List 390](43-project-form/list-390.png) | ![Error 390](43-project-form/form-error-390.png) | ![Edit 1440](43-project-form/form-1440.png) | ![Delete confirmation 390](43-project-form/delete-dialog-390.png) |

## First review applied

A read-only review agent looked at the whole PR diff and the screen pictures. It confirmed the edit flow, the 404 handling, splitting and joining the technologies, and the 10 server message names. It also confirmed that the same-message merging does not remove different messages (the education and career forms differ only when the same message comes twice unchanged). 4 low findings came up.

| Finding                                                                                                                                                                              | Applied                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| If there are 11 or more of the same message, the server sends only 10 and adds "외 1개" (and 1 more) at the end, so the last piece looks different and the message comes twice again | Compare after removing "외 N개" and then add only that count back. Added a test where 10 messages + "외 1개" become one "… 50자 이하여야 합니다, 외 1개" (it fails if I deliberately revert)                                                 |
| The server accepts a technology name with a comma, but if you edit and save such a row on screen the name is split                                                                   | It changes a server rule, so in this PR I wrote it as a known limit in "Decisions"                                                                                                                                                           |
| The document said 15 new tests (actually 14)                                                                                                                                         | Fixed                                                                                                                                                                                                                                        |
| No 400 and 404 tests for the update (PUT)                                                                                                                                            | Added 2 tests: when the server rejects an update, the message under the field and focus; and when a row deleted after opening the form is saved, the guidance "프로젝트를 찾을 수 없습니다" (Project not found) and focus on the save button |

- At 1440 I also checked the list and the delete dialog in the flow with the same result, but I kept only one picture, the edit form.
- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed. Backend: 78 passed and 0 skipped. Frontend: 143 passed and 2 skipped. Skill check: 4 passed. Build: passed. `npm run knip`: passed.

## Second review result

It confirmed that all 4 first-round findings were applied correctly. The "외 N개" handling does not lose a message or the count in any case: the field it first appears in, a message different from the previous one, or after a message with no field name, and the server adds this count only at the very end, so it does not cut off a real message. In the final whole diff there were no findings on correctness, regressions, or accessibility. Reviews end at 2. No issue was split off.
