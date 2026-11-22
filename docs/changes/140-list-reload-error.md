# Show an error when a list reload fails after data loaded (#140)

- The six list screens (careers, educations, projects, certifications, skills, applications) now show `ReloadNotice` (`frontend/src/item-list-page-notice.tsx`) when a reload fails while rows are on screen: "Could not refresh <noun>. The list below may be out of date." plus a "Try again" button that calls `reload()`. Before, the error notice showed only when no data had loaded, so a failed refetch after a delete was silent.
- `formatDate` returns the raw text for an invalid date instead of throwing a RangeError during render, so one bad row cannot break a whole list.
- Tests: `careers.test.tsx` deletes a row with a failing refetch, expects the notice and the remaining row, then retries; new `service-date.test.ts` covers `formatDate('bad')`. The other five lists use the same component and the same condition (checked by typecheck); #145 will move them onto one shared page.
- Verification: `npm run check` (results in the PR).
