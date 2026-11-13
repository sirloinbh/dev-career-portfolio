# #38 Education list screen and menu

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/38>

Note: UI text and fixture data are quoted in Korean as they appear on screen, with an English gloss in parentheses where needed.

## Purpose

Show the education data of the #31 API on screen. Settle the file structure that the list screens of the other items will follow.

## Changes

- `frontend/src/app.tsx`: `pages.educations = '/educations'`, the menu "학력" (Education, icon `GraduationCap`), and the route wiring.
- `frontend/src/education-data.ts`: the `Education` type, the Korean names of degrees and statuses, the period and grade wording, and `educationApi.list`.
- `frontend/src/educations.tsx`: the `EducationList` screen. Loading is `SkeletonList`, an empty list is `EmptyState`, and an error is `Notice` (`role="alert"`).
- `frontend/src/use-load.ts`: `useLoad`, used when a screen first loads. It behaves the same as the hook of the same name in the sibling app cert-manager.
- `frontend/src/educations.test.tsx`: tests for menu navigation, list display, and the loading, empty, and error states.

## Screen structure the next items follow

1. `frontend/src/<singular>-data.ts`: the response type, the Korean names of code values, display wording functions, and the `<singular>Api` object. Rules that can be tested without a screen go here.
2. `frontend/src/<plural>.tsx`: the screen component (`<Name>List`, and a form later). There is one `h1` per page, and an item's title is an `h2`.
3. Load with `useLoad` and draw four states: loading `SkeletonList` (`aria-busy` on the page `section`, and an always-present `sr-only` `role="status"` text changes from "불러오는 중" (Loading) to "N건" (N items). Do not put `aria-label` on a `div` with no role), error `Notice`, empty list `EmptyState`, and the list `ul` (`aria-label="<Name> 목록"`, where 목록 means list).
4. The error message is "<What>을 불러오지 못했습니다. <Cause>" (Could not load <what>. <Cause>). The cause is the server's Korean `error`, and it makes clear what failed even for a proxy error that has no server message.
5. Add the route to `pages` and the menu to `nav` in `app.tsx`.
6. Tests swap `fetch` per address and render `App` at that route.

## Decisions

- **Period font size:** the design system says to use `text-meta` (12px) for meta information such as dates, but in education the period is key information, and the UX checklist blocks body text under 13px. I used `text-body-sm` for the period line.
- **Error message:** at first only the result of `errorText` was shown, but when the API went down only the default message of the central `requestJson`, "요청을 처리하지 못했습니다" (The request could not be processed), was left. I found this in the browser check and put "학력을 불러오지 못했습니다." (Could not load education.) in front.
- **Sorting:** the screen uses the order the API gave (newest admission date first) as it is.
- **Ended period:** when there is no graduation date, enrolled and on leave are left open like "2024-03-04 ~", and graduated and dropped out show only the start date so they do not read as in progress.
- The add button and edit and delete are built in #39.

## First automatic review

The findings were applied in an additional commit.

| Finding                                                                                   | Action                                                                             |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| The loading area was an `aria-label` on a `div` with no role, so screen readers ignore it | Changed to `role="status"` and `sr-only` text, and the test finds it by role       |
| The graduation check also passed through "졸업 작품" (graduation project) in the memo     | Check the status badge text directly and check that "재학 중" (enrolled) is absent |
| The order test was already newest first, so it passed even if the screen sorted again     | Give a non-newest order and check it shows as given                                |
| (Suggestion) A dropout with no graduation date ends in "~" and looks in progress          | Changed as in "Ended period" above                                                 |

Suggestions not applied: the Skeleton shape (a round icon) differs from the real row, and the Skeleton shows even when loading finishes within 300ms. The sibling app cert-manager is the same and it is the shape of a shared component, so I do not fix it per screen. A retry button on error is not in the completion criteria, so I did not add it. The screenshot being 1px taller vertically is because it captured the document height (845px) as it is.

## Second automatic review (final)

It confirmed that the 4 first-round fixes were applied correctly, and the findings were applied in an additional commit. Reviews end at 2.

| Finding                                                                                                           | Action                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A long school name with no spaces, or a URL in the memo, could overflow sideways at 390px because of `break-keep` | `wrap-anywhere` on the school name, `wrap-break-word` on the major and memo. Checked again in the browser with a long school name and a URL                     |
| (Suggestion) A `role="status"` that appears only while loading may not be announced                               | `aria-busy` on the page `section`, and the always-present status text changes from "학력을 불러오는 중" (Loading education) to "학력 N건" (N education entries) |
| (Suggestion) A graduation with no graduation date and the item title `h2` are not tested                          | Added tests                                                                                                                                                     |

The page being 1px longer is caused by the shared layout (the 1px header border in `app-shell.tsx`), so I do not fix it in this PR. No finding was split into a new issue.

## Verification

- `npm run check`: the result is recorded in the PR body.
- Real browser: I drove the installed Chrome (headless) directly through the Chrome DevTools protocol, because the Claude in Chrome extension was not connected and the repository has no Playwright. I pointed the dev servers (API 3108, Vite 5208) at `career_test` on a temporary PostgreSQL 17 and put in 3 made-up education entries through the API.

| State                                                                                       | 390×844                                                                                                                           | 1440×900                                                                                          |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| List of 3                                                                                   | No horizontal overflow, no text under 13px, newest admission date first, the graduate school shows "재학 중" (enrolled)           | Same, and the text is distinguishable in both light and dark (only the dark screenshot was saved) |
| Empty list                                                                                  | "아직 등록한 학력이 없습니다" (No education registered yet) is shown                                                              | Same (measurements only, no screenshot)                                                           |
| API stopped                                                                                 | The alert "학력을 불러오지 못했습니다. 요청을 처리하지 못했습니다" (Could not load education. The request could not be processed) | Same (measurements only, no screenshot)                                                           |
| A long school name (40+ characters with no spaces) and a URL memo (after the second review) | No horizontal overflow, text wraps                                                                                                | No horizontal overflow                                                                            |

- Keyboard: `Tab` moved through skip-to-content → app name → screen mode → dashboard → education → settings, and the focus indicator was visible on all of them. There were no console errors.
- Tap targets under 44px: the menu-open and screen-mode buttons (36px) and the skip-to-content link in the shared layout. This screen added no tap target. The shared layout is a centrally managed file, so I do not fix it here.

Screenshots (made-up data): [list 390 light](38-education-list/list-390-light.png), [list 1440 dark](38-education-list/list-1440-dark.png), [empty list 390](38-education-list/empty-390-light.png), [error 390](38-education-list/error-390-light.png), [long text 390](38-education-list/long-text-390-light.png)

## Limits

- I did not do a real phone or an axe check. The e2e of this repository (including axe) is still off.
- I cannot check running Docker Compose on this PC (BIOS virtualization is off).
