# Move past-deadline drafts to the back of the application list (#83)

Issue: [#83](https://github.com/sirloinbh/dev-career-portfolio/issues/83) (parent issue #68, applications and cover letters)

## Purpose

The application list sorted drafting items by the earliest deadline first (#36), so a drafting item whose deadline had already passed came first. The user wants the items they can still work on first.

## Changes

- `backend/src/routes/applications.ts`: `GET /api/applications` adds one sort key after the status. A drafting item whose deadline is before today goes after the other drafting items. The rest of the order is unchanged.
- `backend/src/app.ts`: passes the existing `today` option (the service date, Asia/Seoul) to the application routes, so the API and the tests share one "today".
- `frontend/src/applications.tsx`: the page description says that drafts past their deadline come after the other drafts.
- `docs/changes/36-application-api.md` and `docs/changes/48-application-list.md`: a note that #83 changed the order.

## Decisions

- **Where the past-deadline drafts go:** at the end of the drafting group, after the drafting items with no deadline and before submitted and closed items. They are still drafting, so they stay with their status. They come after the undated drafts because an undated draft can still be worked on.
- **Order inside the past-deadline group:** the earliest deadline first, as in the other groups (the issue asked to keep it).
- **Only drafting moves:** submitted and closed items keep the deadline order even when the date is past. The screen also shows "Overdue" only while drafting.
- **"Past" means before today in Asia/Seoul.** An item due today is not past, the same as the "Due today" label on the screen. The SQL compares `deadline < $2::date` with the service date from `serviceDate()`, not the database clock.

## Verification

- `backend/test/applications.integration.test.ts`: the service date is fixed at 2026-11-16 (it was the real clock before, so the test would have moved with the date).
  - It adds drafting items due yesterday, due last year, and due today.
  - It checks the full order: due today first, then the other dated drafts, the undated drafts, the two past drafts (the earliest first), then submitted and closed (both with past deadlines, still in date order).
  - With the service date set a day earlier (2026-11-15), the item due 2026-11-15 is due today and comes first, not with the past items.
- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` pointed at `career_test` on a throwaway Docker PostgreSQL 17 with `database/migrations` applied.
  - Backend: 89 passed and 0 skipped (the DB integration tests ran).
  - Frontend: 212 passed and 2 skipped (the existing theme-conditional tests).
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- Before the check, `npm ci` (approved by the user) installed `@sirloinbh/auth-client@1.0.0`, which the lock files already pinned since #106.
- No browser screenshots: only the order changed, and the screen shows the API order as it is (#48).

## Review

- Round 1 (PR #109): no bugs. Two nits.
  - Applied: `docs/changes/48-application-list.md` no longer says "a passed deadline comes first" next to the #83 note. The sentence now says what changed and when.
  - Not changed: passing `today` to `withApi` re-indents the test body. That is formatting only, and the option has to be passed there.
