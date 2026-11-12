# #48 Job application company list screen and cover letter menu

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/48> (parent issue #68, application companies and cover letters)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Show the application company data of the #36 API under the "자기소개서" (Cover letter) menu. The structure is the same as the #46 certification list. Create, update, and delete are built in #49, and the per-company cover letter questions are built in #50 and #51.

## Changes

- `frontend/src/app.tsx`: `pages.applications = '/applications'`, the menu "자기소개서" (Cover letter, icon `FileText`, after Certifications), and the route wiring.
- `frontend/src/application-data.ts`: the `Application` type, the status names (drafting, submitted, closed), the deadline sentence `deadlineText`, and `applicationApi.list`.
- `frontend/src/applications.tsx`: the `ApplicationList` screen.
  - It uses loading `SkeletonList`, an empty list `EmptyState`, and an error `Notice` (`role="alert"`).
  - It puts `aria-busy` on the page `section` and always keeps an `sr-only` status text ("지원 기업을 불러오는 중", Loading application companies → "지원 기업 N건", N application companies). It is the same as the other items.
- Moved to shared code (the behavior is the same):
  - `frontend/src/service-date.ts`: the service date `serviceToday` (moved from the certification data file) and the days left `daysUntil`.
  - `frontend/src/web-link.ts`: `webLink`, which keeps only http(s) addresses (moved from the project data file).
  - `frontend/src/out-link.tsx`: `OutLink`, a link that opens in a new tab (moved from the project screen).
  - The project and certification screens and their tests use the new locations.
- `frontend/src/applications.test.tsx`: tests for menu navigation, the list order and display, the job posting link, a link that is not http(s), an empty list, errors (server error and connection failure), loading, and the display rule functions (9 tests).

## Decisions

- **The menu and the screen name are "자기소개서" (Cover letter).** The issue named the menu "자기소개서". Like the other items, I made the menu name and the page title the same so the current location is clear. The list itself is called "지원 기업 목록" (application company list), because cover letter questions are attached to each company (#37).
- **What one item shows:**
  - The company name (`h2`) and a status badge
  - The position applied for (if entered)
  - The deadline sentence
  - The memo (if entered)
  - A "채용 공고" (Job posting) link (opens in a new tab)
- **Status badge:** distinguished by text (drafting, submitted, closed). The fill only helps tell them apart at a glance (drafting is filled, submitted is a light fill, and closed is an outline).
- **Deadline sentence:**
  - While drafting, it adds the days left: "마감 2026-11-08 · D-3" (Deadline 2026-11-08 · D-3), "· 오늘 마감" (due today), "· 마감 지남" (deadline passed).
  - For submitted and closed, only the date shows, because days left have no meaning for an application already sent.
  - If there is no deadline, it is "마감일 없음" (No deadline).
  - The days are counted in the same service time zone (Asia/Seoul) as the certification list. The test checks it at 00:30 Korean time, which is still the previous day in UTC.
- **Order:** the API order is used as it is: status (drafting → submitted → closed), then earliest deadline first (a passed deadline comes first, no deadline goes last), then the later registration first (#36). I did not split it by status headings. The order and the badge are enough to tell them apart, and the number of items is small.
- **Job posting link:** the server stores only http(s), but the screen also filters once more with `webLink` so an address such as `javascript:` does not go into `href`. The link name is "○○ 채용 공고 (새 탭에서 열림)" (○○ Job posting (opens in a new tab)).

## Verification

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` is `career_test` on the Docker PostgreSQL 17 on this PC.
  - Backend: 87 passed and 0 skipped.
  - Frontend: 201 passed and 2 skipped (the existing theme-conditional tests). It includes the 9 new application company tests.
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- **Real browser:**
  - I drove the installed Chrome (headless 156) through the DevTools protocol.
  - I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 and put in made-up application companies through the API.
  - I made the error state by blocking the `/api/applications` request in the browser.
  - The measurements are whether the page overflows horizontally and the smallest visible text size.
  - The day I took the screenshots was 2026-11-05.

| State                                                                                     | 390×844                                                                                                                                                                                                                                                                                                     | 1440×900                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6 application companies (4 drafting, 1 submitted, 1 closed)                               | No horizontal overflow, smallest text 14px. Status → earliest deadline first (the passed deadline first). It shows "마감 지남" (deadline passed), "오늘 마감" (due today), "D-3", "마감일 없음" (no deadline), and only the date for submitted and closed ([light](48-application-list/list-390-light.png)) | Same. The menu "자기소개서" is marked as the current location, and the three kinds of badges are distinguishable in dark mode ([dark](48-application-list/list-1440-dark.png)) |
| A 100-character company name and position with no spaces, a long posting address and memo | No horizontal overflow. The name, position, and memo wrap and the badge moves below the name ([light](48-application-list/long-text-390-light.png))                                                                                                                                                         | No horizontal overflow (measurements only)                                                                                                                                     |
| Empty list                                                                                | "아직 등록한 지원 기업이 없습니다" (No application company registered yet) is shown, and the status text is "지원 기업 0건" (0 application companies) ([light](48-application-list/empty-390-light.png))                                                                                                    | Same (measurements only)                                                                                                                                                       |
| Request failed                                                                            | The alert "지원 기업을 불러오지 못했습니다. 서버에 연결할 수 없습니다" (Could not load application companies. Cannot connect to the server) ([light](48-application-list/error-390-light.png))                                                                                                              | Same (measurements only)                                                                                                                                                       |

## Limits

Create, update, delete, and the add button and item menu on the list are built in #49, and the per-company cover letter question screens are built in #50 and #51.

## First review applied

There was no defect. What the review confirmed is below.

- The status names match the backend values.
- The days-left calculation is right at month end, year end, and leap days, and it counts by the Korean date.
- The code moved to shared modules does not change the behavior of the project and certification screens.
- The three kinds of badges are distinguishable in dark mode too.

3 low findings were applied.

| Finding                                                                                                                                                | Applied                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The test comment says "no empty line if there is no position", but it actually checked only the memo block                                             | Made it check that an item with no position, link, or memo has only the one line "마감일 없음" (No deadline)                                                            |
| The empty list guidance said "when you register", which reads as telling you to use a register feature that does not exist yet (register is #49)       | Changed it to "등록한 지원 기업이 상태와 마감일 순으로 여기에 보입니다" (Registered application companies show here in the order of status and deadline)                |
| The description said "from the closest deadline", but actually a drafting item with a passed deadline comes first (the ascending order decided in #36) | Changed the description to "같은 상태에서는 마감일이 이른 곳부터 봅니다" (Within the same status, look from the earliest deadline). The order stays as the #36 decision |

- I took the 5 pictures again with the changed wording. The measurements are the same as the first time (no horizontal overflow, smallest text 14px).

- After applying it, `npm run check` (`career_test`): passed. Backend: 87 passed and 0 skipped. Frontend: 201 passed and 2 skipped. Skill check: 4. Build: passed.
- CI `verify`, `docker-build`, and CodeQL of the first commit `8a7d95a` all passed.

## Second review result

There was no defect. What the review confirmed is below.

- If the code is changed to leave an empty line on an item with no position, the new check fails.
- The code moved to shared modules keeps the same behavior.
- The 5 pictures taken again match the explanations in the document.

1 low finding was applied. I changed "the nearest deadline order" that remained in the "Decisions" section and the verification table of this document to "the earliest deadline order (a passed deadline first)". Reviews end at 2. No issue was split off.
