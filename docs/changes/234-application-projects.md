# An application remembers its highlighted projects (#234, part 2)

Each application can now highlight some of the stored projects, and the Resume screen can start from that choice. This finishes #234 together with the resume screen (PR #277).

- Migration `016_application_projects.sql`: table `application_projects (application_id, project_id)`, both sides cascade, safe to run again.
- API (new file `backend/src/routes/application-projects.ts`): `GET /api/applications/:id/projects` returns `{ projectIds }`, newest project first; `PUT` replaces the whole list in one transaction (repeated ids count once, at most 50). Unknown application → 404; unknown project → 400 "Project not found" and nothing changes.
- Application page: a "Highlighted projects" section (checkbox per project, "Save highlighted projects"). It is mounted from `cover-letter-questions.tsx` with one line, next to the interview section.
- Resume screen: "Start from an application" checks only that application's projects; the other sections keep their checks.
- Export/import: `application_projects` is part of the data file (`dataTables`, `docs/data-format.md`), so a restore keeps the links.

| File                                                                                   | Change                              |
| -------------------------------------------------------------------------------------- | ----------------------------------- |
| `database/migrations/016_application_projects.sql`                                     | Link table                          |
| `backend/src/routes/application-projects.ts`, `app.ts`, `openapi.ts`, `routes/data.ts` | Routes, registration, docs, export  |
| `backend/test/application-projects*.test.ts`, `openapi.test.ts`                        | Input checks; DB test (runs in CI)  |
| `frontend/src/application-projects*.ts(x)`, `cover-letter-questions.tsx`, `resume.tsx` | Section, data calls, resume starter |
| `docs/openapi.json`, `docs/data-format.md`                                             | Regenerated / updated               |

Tests: validation tests run locally; the DB integration test (link, replace, unknown ids, cascade on both sides) is skipped without `TEST_DATABASE_URL`, so CI is its proof. Screen tests cover the section and the resume starter. Browser check at 390x844 and 1440x900 is in the PR.
