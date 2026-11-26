# #245 Open on Today and use the shared menu order

Shared rule: sirloinbh/project-standards#1128. User choice A (2026-11-27, recorded on #245): the start page is **Today**; there is no Week or 12-week view in this app.

## Change

| File                                       | Change                                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/today.tsx`, `today.test.tsx` | New start page `/`: drafting applications that are overdue, due today, or due in the next 7 days, plus an "Add application" button                                           |
| `frontend/src/application-data.ts`         | `dueApplications` picks and groups the rows; submitted, closed and no-deadline applications are left out                                                                     |
| `frontend/src/app.tsx`, `app.test.tsx`     | Dashboard moves to `/dashboard`; menu order is Today, Education, Career, Projects, Skills, Certifications, Cover letters, Dashboard, Settings. Unknown addresses go to Today |

Old links to `/` now open Today (the Dashboard was only a placeholder page, so nothing else linked to it).
