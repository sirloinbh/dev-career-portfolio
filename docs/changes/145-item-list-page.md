# Extract a shared ItemListPage for the entity lists (#145)

- New `frontend/src/item-list-page.tsx`: `ItemListPage` owns the load (`useReloading`), skeleton, first-load and reload error notices (#140), empty state, count status line, "Add" button, and the delete-then-focus flow. `ItemUl` is the shared list card. Each screen passes its title, texts, loader, API call and a `renderRows` function.
- All six lists (careers, educations, projects, certifications, skills, applications) use it, one entity per commit. Visible text and markup are unchanged; skills still groups rows by category inside `renderRows`.
- Each screen keeps its original `loadX` for the edit form and adds `loadXRows` (rows only) for the list, so the edit screens are untouched.
- Tests: new `item-list-page.test.tsx` (placeholder, count, empty state, failed first load, delete with focus move, failed reload with retry); the existing list and form tests pass unchanged.
- Verification: `npm run check` (results in the PR).
