# Fix two migrations numbered 013 (#267)

PRs #263 (#229) and #262 (#225) each added a migration numbered 013, and both merged, so the migration test failed on `main`. `013_project_skills.sql` is now `014_project_skills.sql`. Nothing was deployed between the merges, so no database has applied either file yet.

- `013_application_stages.sql` keeps its number; the next free number is 015.
- Updated the references in `backend/test/project-skills-migration.integration.test.ts` and `docs/changes/225-project-skills.md`.

Tests: `npm run check` (the migration test passes again). DB integration tests skip locally; CI runs them.
