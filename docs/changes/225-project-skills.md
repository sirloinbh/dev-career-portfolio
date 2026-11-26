# Link project technologies to the skills list (#225)

A project now picks its technologies from the skills table. Each skill shows the projects that used it and how long it was used.

User decision 2026-11-27: match technology names to skills by name (case-insensitive, trimmed) and create a new skill for each unmatched name.

- Migration `014_project_skills.sql` adds `project_skills (project_id, skill_id)` (both sides cascade), moves every `projects.technologies` name into it, then clears the names from the column. The column stays (unused, empty): CI applies every file twice and `011` still refers to `technologies`, and an applied file cannot be edited, so dropping it would break the second run. A name with no matching skill becomes a new skill (category Other, proficiency 1, a memo saying where it came from). Safe to run again.
- API: a project takes and returns `skillIds` (replacing `technologies`); an unknown id is a 400 "Skill not found". Create and update run in one transaction. `GET /api/skills` adds `projects` (newest start first) and `usedMonths` (whole months, overlaps counted once, an open-ended project counted up to today in Asia/Seoul; same rule as the career total).
- Screens: the project form has a "Skills used" checkbox list with an inline "Add skill" (a known name is only checked; a new one is created as Other, level 1). The project list shows the skill names as tags. The skill list shows "N projects · X years Y months" and the project names.
- `backend/src/usage-period.ts` repeats the month rule of `frontend/src/experience.ts`, because the two workspaces share no package.

| File                                                                       | Change                                                                                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `database/migrations/014_project_skills.sql`                               | Join table, data move, names cleared from the old column                                                         |
| `backend/src/routes/projects.ts`, `skills.ts`, `usage-period.ts`           | `skillIds`, usage fields, month rule                                                                             |
| `backend/test/*`                                                           | Input checks, FK mapping, link / replace / skill delete, usage period, migration on sample data (scratch schema) |
| `frontend/src/project-skill-picker.tsx`, `projects.tsx`, `project-data.ts` | Picker and tags                                                                                                  |
| `frontend/src/skills.tsx`, `skill-data.ts`                                 | Usage on the skill list                                                                                          |
| `docs/openapi.json`                                                        | Regenerated                                                                                                      |
