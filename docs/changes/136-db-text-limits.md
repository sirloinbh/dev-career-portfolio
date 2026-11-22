# Enforce API text limits and trimmed text in the database (#136)

- `database/migrations/010_text_limits.sql` adds a named CHECK constraint (`<table>_<column>_text`) to every text column the API limits: a required column must be non-blank and at most the API limit; an optional column is NULL or non-blank and within the limit. The limits are copied from `backend/src/routes/*.ts` (links 500, cover letter answer 5000). It is safe to run again (an existing constraint name is skipped).
- Not constrained: columns the API does not limit (none left), and untrimmed edges (JS `trim` and PostgreSQL `btrim` disagree on some Unicode spaces, so the API stays the trimmer).
- Test: `backend/test/text-limits.integration.test.ts` (whitespace-only `company`, over-length company/duties, blank `department` refused; the limit and NULL accepted). It needs `TEST_DATABASE_URL`, so it is skipped locally and runs in CI.
- Not verified here: applying the migration to a copy of the production schema (no local database). Existing rows were written through the API with the same rules, so they should pass; if a row does not, the runner rolls the file back and names it.
