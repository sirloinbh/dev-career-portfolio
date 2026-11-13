# #40 Career (work history) list screen and menu

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/40> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Show the career (work history) data of the #32 API on screen. It has the same structure as the #38 education list.

## Changes

- `frontend/src/app.tsx`: `pages.careers = '/careers'`, the menu "이력" (Career, icon `Briefcase`, after Education), and the route wiring.
- `frontend/src/career-data.ts`: the `Career` type, the Korean names of employment types, whether currently employed (`isCurrent`), the period and affiliation wording, and `careerApi.list`.
- `frontend/src/careers.tsx`: the `CareerList` screen. Loading `SkeletonList`, an empty list `EmptyState`, an error `Notice` (`role="alert"`), `aria-busy` on the page `section`, and an always-present `sr-only` status text ("이력을 불러오는 중", Loading career → "이력 N건", N career entries) are the same as education.
- `frontend/src/page-header.tsx`: moved `PageHeader` and `BackLink`, which were inside the education screen, so the item screens share them. `BackLink` takes the name of the list to go back to. The education screen behaves the same.
- `frontend/src/careers.test.tsx`: tests for menu navigation, keeping the API order, the currently employed display, omitting empty fields, the loading, empty, and error states, and the wording functions.

## Decisions

- **Currently employed:** with no end date, the person is currently employed (a #32 decision, no status field). "재직 중" (currently employed) shows in a badge next to the company name and at the end of the period ("2024-01-02 ~ 재직 중"). A career that has ended gets no badge.
- **Affiliation line:** of department · position · employment type, only the ones entered are joined with " · ". The employment type is required, so the line is never empty.
- **Duties and achievements:** only the ones entered are shown with their titles, and line breaks are kept as they are. If empty, the title is not shown either.
- **Sorting:** the screen uses the order the API gave (newest start date first) as it is.
- **Loading the list:** this screen only reads, so it uses `useLoad`. `useReloading`, which keeps the list after a delete, is swapped in by #41, which adds create, update, and delete.
- The add button and edit and delete are built in #41.

## Verification

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 96 passed and 2 skipped (the existing theme-conditional tests, including 9 new career tests). Skill check: 4 passed. Build: passed. `npm run knip`: passed.
- Real browser: I drove the installed Chrome (headless 156) through the DevTools protocol. I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 on this PC and put in 3 made-up career entries through the API. I made the error state by blocking the `/api/careers` request in the browser. The measurements are whether the page overflows horizontally and the smallest visible text size.

| State                                                                          | 390×844                                                                                                                                                               | 1440×900                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| List of 3                                                                      | No horizontal overflow, smallest text 14px, newest start date first, only the currently employed company has the badge ([light](40-career-list/list-390-light.png))   | Same, and dark mode text is distinguishable ([dark](40-career-list/list-1440-dark.png)) |
| A long company name (40+ characters with no spaces) and duties with a long URL | No horizontal overflow, text wraps ([light](40-career-list/long-text-390-light.png))                                                                                  | No horizontal overflow (measurements only)                                              |
| Empty list                                                                     | "아직 등록한 이력이 없습니다" (No career registered yet) is shown, and the status text is "이력 0건" (0 career entries) ([light](40-career-list/empty-390-light.png)) | Same (measurements only)                                                                |
| Request failed                                                                 | The alert "이력을 불러오지 못했습니다. 서버에 연결할 수 없습니다" (Could not load career. Cannot connect to the server) ([light](40-career-list/error-390-light.png)) | Same (measurements only)                                                                |

## CI result of the first commit

- CI `verify` (f0393ef): backend 78 passed and 0 skipped, and the frontend tests, build, and knip passed. `docker-build` and CodeQL passed.

## First review applied

There were no high or medium findings, and 2 low findings were applied.

| Finding                                                                                                                                                     | Applied                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The loading test checks only the status text, so it passes even if the page's `aria-busy` is missing or stays `true` after loading                          | Check `aria-busy="true"` while loading and `"false"` after loading                                                                                                                       |
| The "담당 업무" (Duties) and "주요 성과" (Achievements) titles and contents are separate paragraphs, so a screen reader cannot tell where the block changes | Changed to a description list (`dl`, `dt`, `dd`) to tie the title and content together. The test checks with the `term` and `definition` roles. The next item screens follow this method |

- The education loading test has the same gap, but this PR changes only the career screen, so I left the education test as it is.
- I took the changed screens again (list 390 light, list 1440 dark, long text 390). The look is the same, and no horizontal overflow and the 14px smallest text are the same too.
- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 96 passed and 2 skipped. `npm run knip`: passed.
- CI `verify` (a03fbf0): passed. `docker-build` and CodeQL passed.

## Second review result

It confirmed that both first-round findings were applied (the page's `aria-busy` found by the `region` role, and the same shape as a valid `dl > div > dt + dd` structure). It also checked the final whole diff and the explanations in this document, and there are no new findings. Reviews end at 2. No issue was split off.
