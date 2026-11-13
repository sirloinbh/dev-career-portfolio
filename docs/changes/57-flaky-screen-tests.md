# #57 Frontend screen tests that sometimes fail on a busy PC

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/57>

## Purpose

During the #33 work, `npm test -w frontend` failed once. Find the cause and make the screen tests give the same result even when the PC is busy.

## Cause

- The place that failed was the check in `frontend/src/education-form.test.tsx` that finds the list title after adding or editing education (line 113 `a new education is sent to the API and appears in the list`, and line 186 `an education is edited with its saved values filled in`). When I ran 3 frontend tests at the same time on the same PC, 6 times each, 17 of 18 runs failed (1 failure 15 times, 2 failures 2 times).
- Measuring step by step, the app is fast. Running only this file, the save request took 8ms, the address change 28ms, and showing the title 44ms.
- What is slow is the test query. `findByRole` walks the whole screen and computes accessible names and visibility, so even running only this file it took 50 to 60ms each time, and 130 to 250ms when the whole test suite ran in parallel. From pressing save to finding the list title, on a full run it took 0.7 to 1.1 seconds when idle and 1.5 to 8.1 seconds when busy.
- The default limit of Testing Library's `findBy*` and `waitFor` (`asyncUtilTimeout`) is 1 second, so exceeding it fails. `frontend/vitest.config.ts` raised the test limit to 15 seconds on the reasoning "a busy PC is not a failure", but it did not raise this waiting limit.

## Changes

- `frontend/src/test/setup.ts`: `configure({ asyncUtilTimeout: 8_000 })`. It raises the waiting limit of every screen test to 8 seconds. The first commit was 10 seconds, and I reduced it to 8 seconds after the first review (see "First review applied" below).
- `frontend/src/test/setup.test.tsx`: a regression test that finds, with `findByRole`, a title that appears after 1.5 seconds. Before the fix it fails at 1 second (`Unable to find role="heading"`), and after the fix it passes.

## Decisions

- **I changed the shared setting instead of fixing the tests.** The slow query is not a problem of this one file only; it is in every screen test that draws the whole app. If I gave `timeout` line by line, the same thing would happen in the next test.
- **I did not use the way of making the query lighter.** Changing to `getByText` or `hidden: true` makes it faster, but it weakens the meaning of a test that checks "is it a visible title".
- `frontend/vitest.config.ts` is a centrally managed file, so I put the change in `setup.ts`, which this project edits.
- **Why 8 seconds:** it nearly covers the longest wait (8.1 seconds in the 3-at-a-time run), and leaves about 7 seconds of the 15-second test limit for the rest of the test. This is so a real failure ends with Testing Library's message and the screen at that time, not with vitest's `Test timed out`. Still, a test that already took more than 7 seconds before the wait can still hit the test limit first (#60).

## Verification

- `npm test -w frontend -- src/test/setup.test.tsx` before the fix: 1 failure (timed out at 1045ms). After the fix: passed.
- `npm run check`: passed (exit code 0). Backend: 36 of 46 passed and 10 skipped (the DB integration tests were skipped because this PC has no PostgreSQL). Frontend: 87 passed and 2 skipped (the existing theme-conditional tests). Skill check: 4 passed.
- Repeated runs under load (`npm test -w frontend`, based on the first commit):

  | Condition                   | Before the fix                       | After the fix (first commit, 10 seconds)                  |
  | --------------------------- | ------------------------------------ | --------------------------------------------------------- |
  | 3 at once × 6 runs          | 17 of 18 runs failed (1 second wait) | 17 of 18 runs passed, 1 failed (test limit of 15 seconds) |
  | 2 at once × 4 runs          | Not measured                         | All 8 runs passed                                         |
  | One at a time (earlier #33) | 1 of 8 runs failed                   | All 3 runs passed, including `npm run check`              |

## Limits

- The failures that remain in 3 at once × 6 runs (1 of 18 runs at 10 seconds in the first commit, 4 of 18 runs at 8 seconds in the final) are all the vitest test limit (15 seconds), not the waiting limit. The number swings a lot from run to run, so I do not treat the result of one batch as a fixed failure rate. In the first commit run, `a new education is sent to the API and appears in the list` took 17.4 seconds (4.2 seconds when the whole frontend test suite is run one at a time). In normal runs, `npm run check`, and CI there is more than 3 times of margin to the limit, so I did not touch it further in this PR. The test limit is set by the centrally managed file `frontend/vitest.config.ts`, so I split the remaining work into [#60](https://github.com/sirloinbh/dev-career-portfolio/issues/60).
- I could not identify which test produced the first failure (#33), because there was no record at the time. The same symptom reproduced under load only in these two tests (education add 17 times, education edit 2 times), so I take it to be the same cause.

## First review applied

| Finding                                                                                                                                                                                                 | Applied                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (Medium) The completion criterion "0 failures in 3 at once × 6 runs" was not met, yet the PR closes the issue and says "nothing to check". The remaining problem is not tracked anywhere                | Split the remaining work (the 15-second test limit) into [#60](https://github.com/sirloinbh/dev-career-portfolio/issues/60), and wrote it in the #57 issue comment and in "Please check before merging" in the PR |
| (Low to medium) The explanation "on a real failure Testing Library shows the screen" is not always right. A test that already took more than 4 seconds hits the 15-second limit during a 10-second wait | Reduced the wait to 8 seconds to leave about 7 seconds for the rest, and changed the comment and the record to "usually so, and a test that took long can hit the limit first"                                    |
| (Low) The test name in the record differs from the real name. "When normally run one at a time it takes 4.2 seconds" is vague                                                                           | Wrote the real test name and changed it to "when the whole frontend test suite is run one at a time"                                                                                                              |
| (Note) A test that checks the waiting limit is shorter than the test limit, and the point that with vitest fake timers it really waits up to 8 seconds                                                  | No test uses fake timers now and the limit value has its reasoning in a comment, so no action                                                                                                                     |

Split issue: #60.

Verification of the first fix round (8-second wait):

- `npm test -w frontend -- src/test/setup.test.tsx`: passed.
- `npm run check`: passed (exit code 0). Backend: 36 passed and 10 skipped (DB integration tests, confirmed in CI `verify`). Frontend: 87 passed and 2 skipped. Skill check: 4 passed.
- 2 at once × 4 runs: all 8 runs passed.
- 3 at once × 6 runs: 14 of 18 runs passed and 4 failed. All 4 were `Test timed out in 15000ms` (the test limit) of `a new education is sent to the API and appears in the list`, and there were 0 failures that hit the waiting limit (`Unable to find`). The difference from the 10-second run (1 failure) is the swing in total test time with PC load, and this case is handled in #60.

## Second review applied

All first-round findings were applied, and the result was that there are no more correctness or regression problems in the code. Reducing the waiting limit does not increase the total time of passing tests, so I also confirmed that the interpretation that the 4 failures in the 8-second re-run are not caused by this change is right. The remaining findings were only about the accuracy of the text, and all were applied.

- The `setup.ts` comment: 8 seconds does not "cover" 8.1 seconds, so I changed it to "nearly covers".
- The Limits section: it had only the first commit (10 seconds) numbers, so I wrote both the 10-second and 8-second results and added that it swings from run to run.
- The #60 body: wrote 4/18 at 8 seconds (1/18 at 10 seconds) and the swing, and changed the completion check to use several batches.
- The PR body: stated that the first load result is at 10 seconds. Changed "this issue (#59)" in the #57 comment to "this PR (#59)".

Reviews are at most 2, so no further review is done. The second round of fixes changed only comments and docs. Verification: `npm run format:check` passed, `npm run lint` passed, and `npm test -w frontend` had 87 passed and 2 skipped.
