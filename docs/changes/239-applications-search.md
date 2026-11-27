# Search and a stage filter for the applications list (#239)

The applications list (menu "Cover letters") reuses the shared toolbar from #238: a search box (company or position), a Stage filter with the eight hiring stages, and a sort.

Rule choices the card left open (defaults, easy to change in `applicationTools`): the search covers company and position only (not notes); the sort choices are "Stage, then deadline" (the API's order, still the default), "Deadline, soonest first" (no deadline last) and "Company A to Z".

| File                                 | Change                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `frontend/src/list-tools.ts`         | New `applicationTools` entry (search text, Stage filter, three sorts)                                           |
| `frontend/src/applications.tsx`      | Passes `tools={applicationTools}` to the list page                                                              |
| `frontend/src/applications.test.tsx` | Screen tests: search by company and position, stage filter, search plus filter with no match, clear, both sorts |
