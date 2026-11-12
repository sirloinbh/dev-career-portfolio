# #45 Skill create, update, and delete screens

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/45> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Create, update, and delete skills from the screen. It uses the shared form modules pulled out in #41 as they are, and settles the wording of the criteria for each proficiency level that #34 postponed.

## Changes

- `frontend/src/skills.tsx`: a "스킬 추가" (Add skill) button on the list, edit and delete for each item, `NewSkill`, `EditSkill`, and the input form `SkillFields`. The list now uses `useReloading`, which keeps the rows after a delete, and shows the level name next to the proficiency ("4/5 · 숙련", 4/5 · skilled).
- `frontend/src/skill-data.ts`: the proficiency levels `proficiencyLevels` and `proficiencyName`, the form state type and conversions (`toSkillForm`, `toSkillInput`), `skillFieldErrors` that splits a server error message per field, and `skillApi.create/update/remove`. The category list `skillCategories` is exported again because the form uses it.
- `frontend/src/form-state.tsx`: it splits a 409 per field as well as a 400. This is so the 409 "이미 등록된 스킬입니다" (The skill is already registered) shows under the skill name field. Other APIs can also return the general 409 "이미 등록된 항목입니다" (The item is already registered) when they hit a DB unique constraint (`backend/src/standard/http.ts`), but that message matches no field name, so it goes to the guidance below the form as before. The only unique constraint now is the skill name.
- `frontend/src/app.tsx`: the routes `/skills/new` and `/skills/:id/edit`, and `skillPaths`.
- `frontend/src/skill-form.test.tsx`: checks create, update, delete, and error display with an in-memory fake API (12 tests at first, 13 after the first review). `skills.test.tsx` was adjusted to the proficiency sentence with the level name.

## Decisions

- **Proficiency criteria (confirmed in the #45 issue comment):** the user asked me to settle the choices with the recommendation, so I settled them with the recommendation below. Only the wording changes, so if you want to change it, fix only `proficiencyLevels`.

| Score | Name            | Criterion                                                                                             |
| ----- | --------------- | ----------------------------------------------------------------------------------------------------- |
| 1     | 입문 (Beginner) | 예제를 따라 해 봤습니다 (I have followed along with examples)                                         |
| 2     | 기초 (Basic)    | 문서를 보며 작은 기능을 만들 수 있습니다 (I can build a small feature with the docs)                  |
| 3     | 실무 (Working)  | 혼자 실무 기능을 만들고 고칠 수 있습니다 (I can build and fix real features on my own)                |
| 4     | 숙련 (Skilled)  | 설계를 정하고 다른 사람의 코드를 검토할 수 있습니다 (I can decide the design and review others' code) |
| 5     | 전문 (Expert)   | 어려운 문제를 풀고 팀에 가르칠 수 있습니다 (I can solve hard problems and teach the team)             |

- **Proficiency input:** five native radio buttons grouped with a `fieldset` and `legend` ("숙련도", Proficiency). The arrow keys move between levels, and the name and criterion of each level are in the radio's name, so a screen reader reads them together. The guidance text and the server message are tied to the `fieldset` with `aria-describedby`. Radios do not support `aria-invalid`, so I did not add it. A new skill has no level preselected, and if you save without choosing, the server's "숙련도는 1~5 사이의 정수여야 합니다" (Proficiency must be an integer from 1 to 5) shows and focus goes to the first level.
- **Duplicate name:** the server rejects a duplicate name with 409, ignoring case (#34). This message shows under the skill name field and focus moves to that field.
- **Category:** a native `select` like education and career, and a new skill starts with "언어" (Language).

## Verification

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 165 passed and 2 skipped (the existing theme-conditional tests, including 12 new skill form tests). Skill check: 4 passed. Build: passed. `npm run knip`: passed.
- Real browser: I drove the installed Chrome (headless 156) through the DevTools protocol. I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 on this PC and started with 8 made-up skills (including Go). Every step used only key input (`Tab`, `Enter`, `Escape`, `Ctrl+A`, arrow and letter keys), no mouse.

Keyboard flow (same result at both 390×844 and 1440×900):

| Step                                                                                                  | Result                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On the list, `Tab` to "스킬 추가" (Add skill) → `Enter`                                               | Moved to `/skills/new`                                                                                                                                               |
| Skill name "go" (differs from the existing Go only by case), `↓` twice at the first proficiency level | 3 points are chosen                                                                                                                                                  |
| "추가" (Add)                                                                                          | Under the skill name field "이미 등록된 스킬입니다" (The skill is already registered), `aria-invalid`, focus moved to the skill name, and the input values were kept |
| Fix the name to "키보드스킬" (keyboard skill) with `Ctrl+A` and "추가"                                | Returned to the list with "스킬 9건" (9 skills), and "3/5 · 실무" after a reload                                                                                     |
| "키보드스킬 수정" (Edit keyboard skill) → `↓` from the chosen 3 points → "저장" (Save) → reload       | "4/5 · 숙련", and the screen reader sentence "숙련도 5점 중 4점, 숙련" (proficiency 4 out of 5, skilled)                                                             |
| "키보드스킬 삭제" (Delete keyboard skill) → dialog → `Escape`                                         | The dialog closes, focus returns to the delete button, and still 9 after a reload                                                                                    |
| "키보드스킬 삭제" again → "삭제" (Delete) in the dialog → `Enter`                                     | "스킬 8건" (8 skills), focus on the page title (`h1`), and still 8 after a reload                                                                                    |

At both sizes there is no horizontal overflow in the list and in the form with an error, and the smallest visible text is 14px.

| List 390                                | Form with an error 390                         | Edit form 1440                            | Delete confirmation 390                                         |
| --------------------------------------- | ---------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------- |
| ![List 390](45-skill-form/list-390.png) | ![Error 390](45-skill-form/form-error-390.png) | ![Edit 1440](45-skill-form/form-1440.png) | ![Delete confirmation 390](45-skill-form/delete-dialog-390.png) |

## First review applied

A read-only review agent looked at the whole PR diff and the screen pictures. There was no defect to block, and it confirmed that the 409 handling change is safe for the other forms. It fixed all 5 findings (2 low, 3 notes).

| Finding                                                                                                                                                                              | Applied                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Low) On a proficiency error focus goes to the first radio, but the error is tied only to the `fieldset`, so a screen reader that reads only the focused field cannot read the error | While an error exists, also tie the error to each radio's `aria-describedby`. Added a test that the error is in the first radio's description                                                              |
| (Low) The radio name is the whole level and criterion, so it is read long each time you move with the arrows                                                                         | Split it into the name "4점 · 숙련" (4 points · skilled) and the criterion as the description. I confirmed in the real Chrome accessibility tree: name "1점 · 입문", description "예제를 따라 해 봤습니다" |
| (Note) The `form-state.tsx` comment mentioned only 400                                                                                                                               | Fixed to 400 and 409                                                                                                                                                                                       |
| (Note) No test for a 409 with no field name                                                                                                                                          | Added a test that the general 409 "이미 등록된 항목입니다" goes to the guidance below the form and focus returns to the save button                                                                        |
| (Note) The document said "other APIs do not return 409"                                                                                                                              | Fixed: they can return the general 409, but it matches no field name, so it goes to the guidance                                                                                                           |

- I ran the keyboard flow again in the real browser (390×844) and confirmed the same result. There are now 13 skill form tests.
- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed. Backend: 78 passed and 0 skipped. Frontend: 166 passed and 2 skipped. Skill check: 4 passed. Build: passed. `npm run knip`: passed.

## Second review result

It confirmed that the first-round findings were applied correctly. The ids of the radios do not collide because of `useId`, the error id is tied only while the error text is visible, and choosing by clicking the label still works. In the final whole diff there were no findings on correctness, regressions, or accessibility. I only fixed the test count (13) in the Changes section and a radio comment. That an error can be read twice, from both the group and the radio, I accepted for screen readers that read only the focused field. Reviews end at 2. No issue was split off.
