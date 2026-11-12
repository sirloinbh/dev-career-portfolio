# #44 Skill list screen by category and menu

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/44> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Show the skill data of the #34 API on screen, grouped by category. It has the same structure as the #40 career and #42 project lists. Create, update, delete, and the wording of the criteria for each proficiency level are built in #45.

## Changes

- `frontend/src/app.tsx`: `pages.skills = '/skills'`, the menu "스킬" (Skills, icon `Wrench`, after Projects), and the route wiring.
- `frontend/src/skill-data.ts`: the `Skill` type, the order and Korean names of the 6 categories, `groupSkills` that groups by category, the proficiency sentence `proficiencyText`, and `skillApi.list`.
- `frontend/src/skills.tsx`: the `SkillList` screen. Loading `SkeletonList`, an empty list `EmptyState`, an error `Notice` (`role="alert"`), `aria-busy` on the page `section`, and an always-present `sr-only` status text ("스킬을 불러오는 중", Loading skills → "스킬 N건", N skills) are the same as the other items.
- `frontend/src/skills.test.tsx`: tests for menu navigation, category grouping and order, the proficiency display, the memo, the loading, empty, and error states, and the grouping function (10 tests).

## Decisions

- **Category groups:** grouped in the #34 category order (language → framework and library → database → infrastructure and cloud → tool → other), and a category with no skills is not shown. Each category has a title (`h2`, "언어 2건", Language: 2 items) with the list below it. A screen reader's heading navigation can jump between categories. A category is not made a landmark (region), and the list is not given a separate name (applied in the first review).
- **Order within a category:** the API order (higher proficiency first → skill name) is used as it is.
- **Proficiency:** the score 1 to 5 shows as five dots (filled count = score) and "4/5". The dots and "4/5" are hidden from screen readers, and it reads "숙련도 5점 중 4점" (proficiency 4 out of 5). It is distinguished by fill and number, not color, so it can be read in dark mode or in black and white. The meaning of each level ("4 points = …") is settled in #45.
- **Memo:** only when entered, it shows as a description list (`dl`) with the title "메모" (Memo) (a #40 review decision).

## Verification

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 153 passed and 2 skipped (the existing theme-conditional tests, including 10 new skill tests). Skill check: 4 passed. Build: passed. `npm run knip`: passed (the category list `skillCategories` is still used only in this file, so it is not exported. #45 exports it for the form).
- Real browser: I drove the installed Chrome (headless 156) through the DevTools protocol. I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 on this PC and put in made-up skills across the 6 categories through the API. I made the error state by blocking the `/api/skills` request in the browser. The measurements are whether the page overflows horizontally and the smallest visible text size.

| State                                                               | 390×844                                                                                                                                                              | 1440×900                                                                                         |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 8 skills (6 categories)                                             | No horizontal overflow, smallest text 14px, grouped in category order, higher proficiency first within a category ([light](44-skill-list/list-390-light.png))        | Same, and dark mode dots and text are distinguishable ([dark](44-skill-list/list-1440-dark.png)) |
| A 50-character skill name with no spaces and a memo with a long URL | No horizontal overflow, the name wraps and the proficiency moves down ([light](44-skill-list/long-text-390-light.png))                                               | No horizontal overflow (measurements only)                                                       |
| Empty list                                                          | "아직 등록한 스킬이 없습니다" (No skill registered yet) is shown, and the status text is "스킬 0건" (0 skills) ([light](44-skill-list/empty-390-light.png))          | Same (measurements only)                                                                         |
| Request failed                                                      | The alert "스킬을 불러오지 못했습니다. 서버에 연결할 수 없습니다" (Could not load skills. Cannot connect to the server) ([light](44-skill-list/error-390-light.png)) | Same (measurements only)                                                                         |

## First review applied

A read-only review agent looked at the whole PR diff and the screen pictures. There was no correctness finding (the category order is the same as the API, and the DB constraint blocks unknown categories so `groupSkills` does not drop rows). It fixed 4 low findings.

| Finding                                                                                                                                                                         | Applied                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Each category was a named `section`, so the landmark list had 7 regions, and on entering, "언어 2건" (region) → "언어 2건" (heading) → "언어 스킬" (list) were read overlapping | Made the category groups plain `div`s and removed the list name. Added a test that there is no category region                                         |
| The empty dot border `border-foreground/40` was faint, about 2.7:1, on a white card in light mode                                                                               | Raised it to `border-foreground/60` (3:1 or more). I took the pictures again                                                                           |
| The "5/5" test passed even without `aria-hidden`                                                                                                                                | Check that "5/5" is `aria-hidden="true"`                                                                                                               |
| The document said "a 50-character skill name", but the name in the picture was 41 characters                                                                                    | Entered and took the pictures again with a name of exactly 50 characters. It wraps at 390 with no horizontal overflow, and 1440 has no overflow either |

- I also changed the empty list test to check that there is no category title ("…건", ... items) instead of the list name.
- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed. Backend: 78 passed and 0 skipped. Frontend: 153 passed and 2 skipped. Skill check: 4 passed. Build: passed. `npm run knip`: passed.

## Second review result

It confirmed that all 4 first-round findings were applied correctly. The category region test would fail with the old `section`, the empty dot border is about 5.2:1 on a white card (about 6.8:1 in dark mode), and the empty list test fails if the filtering of empty categories in `groupSkills` is removed. In the final whole diff there were no findings on correctness, regressions, or accessibility. Reviews end at 2. No issue was split off.
