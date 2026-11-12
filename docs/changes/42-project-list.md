# #42 Project list screen and menu

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/42> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Show the project data of the #33 API on screen. It has the same structure as the #40 career list. Create, update, and delete are built in #43.

## Changes

- `frontend/src/app.tsx`: `pages.projects = '/projects'`, the menu "프로젝트" (Projects, icon `FolderKanban`, after Career), and the route wiring.
- `frontend/src/project-data.ts`: the `Project` type, whether it is in progress (`isRunning`), the period and affiliation wording, `webLink` that uses only web addresses as links, and `projectApi.list`.
- `frontend/src/projects.tsx`: the `ProjectList` screen. Loading `SkeletonList`, an empty list `EmptyState`, an error `Notice` (`role="alert"`), `aria-busy` on the page `section`, and an always-present `sr-only` status text ("프로젝트를 불러오는 중", Loading projects → "프로젝트 N건", N projects) are the same as career.
- `frontend/src/text-blocks.tsx`: moved `TextBlocks` (a description list `dl` with titles), which was inside the career screen, so the item screens share it. It also accepts an element (technology tags) instead of text. The career screen behaves the same.
- `frontend/src/projects.test.tsx`: tests for menu navigation, keeping the API order, the in-progress display, omitting empty fields, links, the loading, empty, and error states, and the wording functions (11 at first, 12 after the first review).

## Decisions

- **In progress:** with no end date, the project is in progress (a #33 decision, no status field). It shows in a badge next to the project name and at the end of the period ("2024-05-01 ~ 진행 중", in progress).
- **Affiliation line:** of organization · role, only the ones entered are joined with " · ", and if both are empty there is no line.
- **Summary, contributions and results, technologies:** only the ones entered are shown as a description list with titles (a #40 review decision). Technologies are a tag list, and even a 50-character name with no spaces wraps at 390px.
- **Links:** "저장소" (Repository) and "서비스" (Service) open in a new tab (`rel="noopener noreferrer"`). The screen reader name says which project the link belongs to and that a new tab opens, like "주문 정산 자동화 저장소 (새 탭에서 열림)" (Order settlement automation repository (opens in a new tab)). The server stores only `http(s)` addresses (#33), and the screen also does not make other formats (`javascript:` and so on) into links. I added a 2px border so the keyboard focus is visible.
- **Sorting:** the screen uses the order the API gave (newest start date first) as it is.

## Verification

- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed (exit code 0). Backend: 78 passed and 0 skipped. Frontend: 125 passed and 2 skipped (the existing theme-conditional tests, including 11 new project tests). Skill check: 4 passed. Build: passed. `npm run knip`: passed.
- Real browser: I drove the installed Chrome (headless 156) through the DevTools protocol. I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 on this PC and put in made-up projects through the API. I made the error state by blocking the `/api/projects` request in the browser. The measurements are whether the page overflows horizontally and the smallest visible text size.

| State                                                                                                                        | 390×844                                                                                                                                                                                             | 1440×900                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| List of 3                                                                                                                    | No horizontal overflow, smallest text 14px, newest start date first, only the in-progress one has the badge ([light](42-project-list/list-390-light.png))                                           | Same, and dark mode text is distinguishable ([dark](42-project-list/list-1440-dark.png)) |
| A long name (no spaces), a long URL, a 50-character technology name, 30 technologies, and a 120-character repository address | No horizontal overflow, text wraps ([light](42-project-list/long-text-390-light.png))                                                                                                               | No horizontal overflow (measurements only)                                               |
| Empty list                                                                                                                   | "아직 등록한 프로젝트가 없습니다" (No project registered yet) is shown, and the status text is "프로젝트 0건" (0 projects) ([light](42-project-list/empty-390-light.png))                           | Same (measurements only)                                                                 |
| Request failed                                                                                                               | The alert "프로젝트를 불러오지 못했습니다. 서버에 연결할 수 없습니다" (Could not load projects. Cannot connect to the server) ([light](42-project-list/error-390-light.png))                        | Same (measurements only)                                                                 |
| Keyboard                                                                                                                     | `Tab` focuses "주문 정산 자동화 저장소 (새 탭에서 열림)" (Order settlement automation repository (opens in a new tab)), 2px border, height 36px ([light](42-project-list/link-focus-390-light.png)) | —                                                                                        |

## First review applied

A read-only review agent looked at the whole PR diff and the screen pictures. There were no findings on correctness, regressions, or security. It confirmed that the career screen is the same apart from the location of `TextBlocks`, that `webLink` makes only `http(s)` into links, and that a `ul` inside a `dd` is a valid structure. It fixed 2 low findings and left 1 note as it is.

| Finding                                                                                                                    | Applied                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Low) The link test checked only the case where both links are bad                                                         | Added a test that checks that, when the repository link is valid and the service link is `javascript:`, only one link (the repository) exists. I confirmed it fails if the service link is changed to the repository address |
| (Low) The "진행 중" (in progress) badge was found as the parent element of the `h2`, so it breaks if the structure changes | Changed to find the badge whose text is "진행 중" inside the row                                                                                                                                                             |
| (Note) The link name does not start with the visible text ("저장소")                                                       | Left as it is. The visible text is in the name, so it satisfies WCAG 2.5.3, and it keeps the same "<name> <action>" order as the other buttons in the list ("한빛소프트 수정", "한빛소프트 삭제")                            |

- There are now 12 frontend project tests.
- `npm run check` with `TEST_DATABASE_URL`=`career_test`: passed. Backend: 78 passed and 0 skipped. Frontend: 126 passed and 2 skipped. Skill check: 4 passed. Build: passed. `npm run knip`: passed.

## Second review result

It confirmed that both first-round findings were fixed correctly (checking that the link count is 1, and finding the badge by its text). In the final whole diff there were no findings on correctness, regressions, or accessibility. The only finding was that the test count in the Changes section still said 11, and I fixed it. Reviews end at 2. No issue was split off.
