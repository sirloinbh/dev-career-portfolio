# #27 Move the backend validation code to zod 4 syntax

- Issue: [#27](https://github.com/sirloinbh/dev-career-portfolio/issues/27)
- Branch: `chore/27-zod4-syntax`

## Purpose

This is step 1 of the central `sirloinbh/project-standards#386`. Move the code first so this app does not break when the central repository raises `zod` to 4.6.7. The Dependabot alert for security advisory GHSA-mrhx-c7xc-m3w5 closes with that sync. This PR alone does not close it.

## Changes — 2026-11-01

- `backend/src/app.ts` imports `ZodError` from `zod/v4`. The installed 3.25.76 contains this path, so the install and the lockfile are unchanged.
- This app has no zod schema yet, so there is no `z.record`, `.default()`, or `z.array` to review.
- Added a test in `backend/test/health.test.ts` that checks an error from a zod 4 schema is answered with 400 and its message.

## Response changes

None. No path throws `ZodError` today.

## Verification

- `npm run check`: passed. Backend: 5 of 6 passed and 1 skipped (the DB integration test was excluded by leaving `TEST_DATABASE_URL` empty). Frontend: 55 of 57 passed and 2 skipped. Skill tests: 4 passed.
- The DB integration test is confirmed by the PR CI.
- The behavior on 4.6.7 is not confirmed yet. It is confirmed by the CI of the central sync PR.
