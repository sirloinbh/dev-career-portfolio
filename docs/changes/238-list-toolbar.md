# #238 Search, filter, and sort on the resume item lists

The career, education, project, skill, and certification lists now have a search box, one filter, and a sort choice. The choices live in the URL query (`q`, `filter`, `sort`), so a reload or a shared link keeps them.

## Rules per section

| List          | Search looks in                                                | Filter                       | Sorts (first is the API order)                                       |
| ------------- | -------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Career        | company, department, job title, duties, achievements           | Employment type              | Newest start, oldest start, company A to Z                           |
| Education     | school, major, memo                                            | Status                       | Newest enrollment, oldest enrollment, school A to Z, degree          |
| Projects      | name, organization, role, summary, contributions, technologies | Year the project was running | Newest start, oldest start, name A to Z                              |
| Skills        | name, memo, category                                           | Category                     | Strongest first, least proficient first, name A to Z (inside groups) |
| Certification | name, issuer, score, memo                                      | Valid / Expired / No expiry  | Newest, expiry date soonest (no expiry last), name A to Z            |

- Everything runs on the client; the lists are short.
- Search matches every word (any order), ignores case and extra spaces, and normalizes Korean to the composed form so macOS input matches.
- An unknown `filter` or `sort` in the URL is ignored, so an old link never hides rows.
- "Expired" uses the service date, so it agrees with the badge on each row.
- No match shows "No entries match" with a button to clear; a list with no rows shows no toolbar.

## Change

| File                                                                                | Change                                                              |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `frontend/src/list-view.ts`                                                         | Pure search, filter, sort, and URL helpers                          |
| `frontend/src/list-tools.ts`                                                        | The rules per section (table above)                                 |
| `frontend/src/list-toolbar.tsx`                                                     | The toolbar controls                                                |
| `frontend/src/item-list-page.tsx`                                                   | Optional `tools` prop: toolbar, URL state, no-match state           |
| `careers.tsx`, `educations.tsx`, `projects.tsx`, `skills.tsx`, `certifications.tsx` | Pass `tools` to `ItemListPage` (one line each)                      |
| `list-tools.test.ts`, `list-toolbar.test.tsx`                                       | Unit tests per section (incl. Korean) and a screen test per section |

## Checks

- `npm run check`: passed (DB integration tests skip locally; CI runs them).
- Browser check with a mock API and vite, Google Chrome engine (Playwright), career list: 390x844 has no horizontal scroll and a `?q=...&sort=company` link restores the search text, the sort, and the filtered row; 1440x900 shows search, filter, sort, and Clear in one row.
