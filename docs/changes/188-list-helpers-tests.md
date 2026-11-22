# Test the shared list helpers (#188)

- New unit tests for helpers every list uses, which were only reached through screen tests:
  - `delete-item.test.ts`: success toast; a 404 counts as deleted; other errors (including an unreachable server) toast the reason and rethrow so the dialog stays open.
  - `entry-count.test.ts`: 0, 1 and 2 entries.
  - `text-blocks.test.tsx`: empty and null entries are hidden, labels are `dt` tied to `dd` text, nothing renders when all are empty.
  - `service-date.test.ts`: `serviceToday` at the Seoul midnight boundary; `daysUntil` for the same day, past, month end and a leap day.
- No app code changed.
- Verification: `npm run check` (results in the PR).
