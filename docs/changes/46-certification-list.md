# #46 Certification list screen and menu

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/46> (parent issue #67, resume item screens)

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Show the certification data of the #35 API on screen. It has the same structure as the #40 career, #42 project, and #44 skill lists. Create, update, and delete are built in #47.

## Changes

- `frontend/src/app.tsx`: `pages.certifications = '/certifications'`, the menu "자격증" (Certifications, icon `Award`, after Skills), and the route wiring.
- `frontend/src/certification-data.ts`: the `Certification` type, the service date `serviceToday`, the expiry check `isExpired`, the period sentence `certificationPeriodText`, the issuer and score sentence `issuerText`, and `certificationApi.list`.
- `frontend/src/certifications.tsx`: the `CertificationList` screen.
  - Loading `SkeletonList`, an empty list `EmptyState`, and an error `Notice` (`role="alert"`) are the same as the other items.
  - `aria-busy` on the page `section` and an always-present `sr-only` status text ("자격증을 불러오는 중", Loading certifications → "자격증 N건", N certifications) are the same too.
- `frontend/src/certifications.test.tsx`: tests for menu navigation, the list order and display, no expiry, the expiry display (including the time zone), an empty list, errors (server error and connection failure), loading, and the display rule functions (9 tests).

## Decisions

- **What one item shows:**
  - The certification name (`h2`) and, if it has expired, an "만료됨" (Expired) badge
  - "Issuer · score or grade" (only the issuer if there is no score)
  - "취득 YYYY-MM-DD · 만료 YYYY-MM-DD" (Acquired YYYY-MM-DD · Expires YYYY-MM-DD)
  - The memo, if entered
- **No expiry:** when the expiry date is `null`, it writes "만료 없음" (No expiry) instead of a date (a completion criterion).
- **Expiry display (a decision #35 handed to the screen):** if the expiry date is before today, it adds the "만료됨" (Expired) badge.
  - It is treated as valid through the day of the expiry date.
  - An expired certification is still part of the history, so it is not removed from the list or dimmed.
  - The badge is distinguished by text, not color (`outline`).
- **Today is based on the service time zone (Asia/Seoul).** It is computed the same way as the server's `serviceDate` (`Intl.DateTimeFormat` with `Asia/Seoul`). Even if the device time zone differs, the expiry display changes at midnight when the Korean date changes. The test checks it at 00:30 Korean time, which is still the previous day in UTC.
- **Order:** the API order (newest acquired date first, the later registration on top for the same day) is used as it is.

## Verification

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` is `career_test` on the Docker PostgreSQL 17 on this PC.
  - Backend: 87 passed and 0 skipped.
  - Frontend: 175 passed and 2 skipped (the existing theme-conditional tests). It includes the 9 new certification tests.
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- **Real browser:**
  - I drove the installed Chrome (headless 156) through the DevTools protocol.
  - I pointed the dev servers (API 3108, Vite 5208) at `career_test` on the Docker PostgreSQL 17 and put in made-up certifications through the API.
  - I made the error state by blocking the `/api/certifications` request in the browser.
  - The measurements are whether the page overflows horizontally and the smallest visible text size.
  - The day I took the screenshots was 2026-11-05. So only the certification whose expiry date is 2025-10-10 got the "만료됨" (Expired) badge.

| State                                                                                            | 390×844                                                                                                                                                                                 | 1440×900                                                                                                         |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 5 certifications (1 expired, 2 with no expiry)                                                   | No horizontal overflow, smallest text 14px, newest acquired date first, "만료됨" only on the 1 expired one ([light](46-certification-list/list-390-light.png))                          | Same. The badge and text are distinguishable in dark mode too ([dark](46-certification-list/list-1440-dark.png)) |
| A 100-character name and issuer with no spaces, a 50-character score, and a memo with a long URL | No horizontal overflow. The name, issuer, and URL wrap and the badge moves below the name ([light](46-certification-list/long-text-390-light.png))                                      | No horizontal overflow (measurements only)                                                                       |
| Empty list                                                                                       | "아직 등록한 자격증이 없습니다" (No certification registered yet) is shown, and the status text is "자격증 0건" (0 certifications) ([light](46-certification-list/empty-390-light.png)) | Same (measurements only)                                                                                         |
| Request failed                                                                                   | The alert "자격증을 불러오지 못했습니다. 서버에 연결할 수 없습니다" (Could not load certifications. Cannot connect to the server) ([light](46-certification-list/error-390-light.png))  | Same (measurements only)                                                                                         |

## Limits

Create, update, delete, and the add button and item menu on the list are built in #47.

## CI result of the first commit

- `75c7d55`: CI `verify`, `docker-build`, and CodeQL all passed. The 2 e2e tests were skipped because they are off by default.

## First review applied

There was no defect. What the review confirmed is below.

- The service date computation is the same as the server's `serviceDate`.
- The day of the expiry date is treated as valid.
- The tests run with `TZ=UTC`. So if `serviceToday` used the device date or the UTC date, the time zone test would fail.
- The fake timers change only `Date`, so the results do not fluctuate. I ran it 4 times and all passed.
- The accessibility structure is the same as the career list.
- The badge and the "메모" (Memo) text are 14px.

1 low finding was applied. The `afterEach(() => vi.useRealTimers())` in the test file does what `src/test/setup.ts` already does, so I removed it and wrote that fact in a comment.

- After applying it, the static checks (format, lint, types) and the frontend tests passed: 175 passed and 2 skipped. The backend did not change.

## Second review result

There was no defect. What the review confirmed is below.

- Even if the duplicate cleanup code is removed, the fake `Date` does not carry over to the next test.
- It computes the date around Seoul midnight correctly and judges the expiry boundary correctly.
- The accessibility structure is the same as the career list.
- The 5 pictures and the table in the document match each other.

One point was left as a note. If you cross Seoul midnight with the page open, the badge changes the next time the screen is drawn. The effect is small in this app, so I leave it as it is. Reviews end at 2. No issue was split off.
