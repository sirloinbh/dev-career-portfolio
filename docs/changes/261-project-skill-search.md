# Search projects by the skills they used (#261)

The project list search now also matches the names of the skills a project used, so searching "Rust" finds the projects that used the Rust skill again (it stopped working when #225 moved technologies into the skills table).

- `projectTools` in `frontend/src/list-tools.ts` is now a function that takes a skill id → name map. Its `searchText` adds the names of the project's skills.
- `ProjectList` in `frontend/src/projects.tsx` loads the skills list (the same query the rows already use, so no extra request) and builds the tools with `useMemo`.
- The search keeps the existing rule: every word must be found, in any of the project's texts.

| File                                                   | Change                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| `frontend/src/list-tools.ts`, `projects.tsx`           | Skill names in the project search                                       |
| `frontend/src/list-tools.test.ts`, `projects.test.tsx` | Unit test of the search text; screen test that finds a project by skill |

Tests: `vitest run src/projects.test.tsx src/list-tools.test.ts` passes. `npm run check` result is in the PR.
