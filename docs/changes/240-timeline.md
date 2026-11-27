# #240 Timeline of careers, education, and projects

A new Timeline page (`/timeline`, menu entry after Certifications) shows careers, education, and projects on one time axis, newest first. It reads the three existing list APIs (no backend change), so edits made on the list pages show here at once.

## Rules

- Order: newest start first; for the same start, the one that ended later comes first, then the title.
- A running career, project, or enrolled / on-leave education ends today in `Asia/Seoul` and shows an "Ongoing" badge. A graduated or dropped-out education without an end date is a point in time.
- Overlap: entries whose periods overlap (a period that starts on the day another ends counts) sit side by side in one group; a gap starts a new group. Groups wrap to one column on a phone.
- A project with a career sits inside that career's card, newest first, and does not take part in overlap grouping. A project without a career, or with a career that is not loaded, is a normal entry.
- Each title links to that item's edit screen.
- Loading, error (with retry), and empty states match the other pages; the live count includes nested projects.

## Change

| File                                                     | Change                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `frontend/src/timeline-data.ts`, `timeline-data.test.ts` | Pure ordering, ongoing, overlap grouping, and nesting rules with tests        |
| `frontend/src/timeline.tsx`, `timeline.test.tsx`         | The page and its screen tests                                                 |
| `frontend/src/app.tsx`                                   | `/timeline` route, `timelinePaths`, and the menu entry (after Certifications) |

## Checks

- `npm run check`: passed (DB integration tests skip locally; CI runs them).
- Browser check (mock API + vite): 390x844 has no horizontal scroll and cards stack in one column; 1440x900 has no horizontal scroll and overlapping entries sit in one row, with the project nested under its career.
