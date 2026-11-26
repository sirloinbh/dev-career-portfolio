# Link projects to the career they were done at (#224)

A project can point to one career entry, and the career list shows the projects linked to it.

User decision 2026-11-27: `projects.organization` stays and is used only when no career is linked; a linked project shows the career's company.

| File                                                    | Change                                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `database/migrations/012_projects_career_link.sql`      | Nullable `career_id` foreign key (`ON DELETE SET NULL`) and an index                      |
| `backend/src/routes/projects.ts`                        | `careerId` in the input and the answer; an unknown career id is a 400 "Career not found"  |
| `backend/test/projects*.test.ts`                        | Input checks, the 400 for a broken link, and link / unlink / delete-career against the DB |
| `docs/openapi.json`                                     | Regenerated                                                                               |
| `frontend/src/project-data.ts`, `projects.tsx`          | Career picker in the form; the list shows the linked career's company                     |
| `frontend/src/careers.tsx`, `career-data.ts`, `app.tsx` | Linked projects under each career, linking to the project's edit screen                   |
| `frontend/src/*.test.ts(x)`                             | Screen tests for picking a career and for the linked projects                             |
