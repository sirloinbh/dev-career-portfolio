# Retry the backend test server when it gets a port fetch blocks (#77)

Issue: [#77](https://github.com/sirloinbh/dev-career-portfolio/issues/77) (parent issue #69, tests and dev tooling)

## Purpose

`withApi` in `backend/test/helpers.ts` starts the app with `listen(0)` and calls it with `fetch`. Node's fetch refuses some ports ("bad ports" in the Fetch standard), so a test failed with `fetch failed: bad port` when the OS handed out one of them. It happened once while verifying #37.

## Cause

On this PC the OS hands out ports 1024–15000 (`netsh int ipv4 show dynamicport tcp`: start 1024, 13977 ports). That range holds 19 blocked ports, such as 1719, 2049, 5060, 6000, 6665–6669, and 10080. Linux CI uses 32768–60999, which holds none, so the failure is local only.

## Changes

- `backend/test/helpers.ts`:
  - `fetchBlockedPorts`: the 82 ports this Node's fetch refuses.
  - `listenForFetch(start, isBlocked, attempts)`: starts a server, and if its port is blocked, closes it and starts another, up to 20 times. It returns the server and its port.
  - `withApi` uses it.
- `backend/test/helpers.test.ts` (new): 3 tests.
  - Every listed port is refused by Node's fetch with the cause `bad port`. fetch checks the port before connecting, so nothing is sent.
  - A port treated as blocked is closed, and the second server answers.
  - After the last attempt it gives up with a clear message and no server is left open.

## Decisions

- **A fixed list, checked by a test.** Node does not export its list. I scanned every port 1–65535 with Node 24.21's fetch, and the 82 refused ports are exactly the Fetch standard's list. The test fails if a later Node refuses a listed port differently. A probe request to each new server would also work, but it would add a request the rate-limit tests could count.
- **Close and ask again**, not a fixed port range. A fixed range could clash with other processes or parallel test files.

## Verification

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` pointed at `career_test` on a throwaway Docker PostgreSQL 17 with `database/migrations` applied.
  - Backend: 92 passed and 0 skipped (89 before, plus the 3 new tests).
  - Frontend: 257 passed and 2 skipped (the existing theme-conditional tests).
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- No screen changed, so there is no browser check.

## Limits

- A blocked port can still be assigned, but it is now replaced before any test request is sent. Twenty blocked ports in a row would be needed to fail.

## Review

- Round 1 (PR #114): no bugs. The reviewer ran its own scan of 1–65535 and got the same list.
  - Applied: the port counts in this record (82 in total, 19 in 1024–15000; it said 83 and 13), and `listenForFetch` now waits with `events.once`, which removes the `listening` and `error` listeners after either fires.
  - Not changed: the test checks that every listed port is refused, not that the list is complete. If a later Node blocks one more port, the retry would not know it, but that port would be one of about 14,000 the OS can hand out here.
  - After the fixes, the helper tests and the `withApi` tests passed again, and CI's `npm run check` ran on the final commit.
- Round 2: the `events.once` change is correct (it rejects on `error` and removes both listeners), `withApi` behaves as before, and the counts match the list. No new findings.
