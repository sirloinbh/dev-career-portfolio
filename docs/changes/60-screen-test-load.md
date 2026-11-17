# Keep screen tests passing on a very busy PC (#60)

Issue: [#60](https://github.com/sirloinbh/dev-career-portfolio/issues/60) (parent issue #69, tests and dev tooling)

## Purpose

#57 left one problem: with 3 frontend test runs at once, a heavy screen test sometimes passed vitest's 15-second limit. This change measures the suite again, fixes the failure that still happened, and checks the result under the same load twice.

## What I found

- **Baseline** (3 runs at once × 6, before any change):
  - 1 test failed in 18 runs: "saving a project deleted after the form opened says it is gone", with `Unable to find ... role "button" and name "Save"`. It was not a timeout.
  - No test hit the 15-second limit. The slowest took 12.1 s.
  - My own probe runs were running at the same time, so this batch was busier than 3 at once.
  - Three more runs in the batch failed only because a half-written probe file of mine was in `src` at the time. I do not count those.
- **The failure is a race in the tests.** Edit pages draw their heading at once and the form only after the item loads (`projects.tsx`: heading, then `SkeletonList`, then the fields). Twelve tests in six files waited for the heading, then read fields or pressed Save at once. When loading was slower than drawing the heading, the form was not there yet.
- **Narrowing queries would not help much.**
  - The form page has 128 elements (54 in `main`), and one role query took about 20–30 ms.
  - Run alone, the whole "a new education is sent to the API and appears in the list" test took 0.4 s.
- **The slow tests are the first test of each file.** In a normal full run the first test takes 2–5 times the median of the rest, for example education form 2.1 s against 0.3 s. That is one-time warm-up (the first render in a fresh worker), slowed further when other runs share the CPU. It is not a property of any one query.

## Changes

- `frontend/src/{application,career,certification,education,project,skill}-form.test.tsx`: after the heading of an edit page, the tests also wait for the form (`findByRole('button', { name: 'Save' })`) before reading a field. 12 places in 6 files; with the cover letter test below, 13 tests.
- `frontend/src/cover-letter-form.test.tsx`: the first test waits for the question list. The title comes from the application list, so it can show before the questions load.
- `frontend/src/test/setup.ts`: the comment about #60 now gives the measured margin.

## Decisions

- **No change to `testTimeout`.** After the fix, no run came near the limit (below), so the centrally managed `frontend/vitest.config.ts` stays as it is, and no issue is needed in `sirloinbh/project-standards`.
- **Wait for the form, not a longer time.** The heading is not a sign that the page is ready, so the tests now wait for what they use. The fix keeps the full-page role queries, which check that the button is visible and named.

## Verification

- Load: 3 frontend runs at once (`vitest run`) × 6 rounds, two batches with nothing else running.

  | Batch             | Failed runs | Slowest test |
  | ----------------- | ----------- | ------------ |
  | Before (baseline) | 1 of 18     | 12.1 s       |
  | After, batch 1    | 0 of 18     | 7.9 s        |
  | After, batch 2    | 0 of 18     | 7.7 s        |

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` pointed at `career_test` on a throwaway Docker PostgreSQL 17 with `database/migrations` applied.
  - Backend: 92 passed and 0 skipped.
  - Frontend: 257 passed and 2 skipped (the existing theme-conditional tests).
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.

## Limits

- Load varies from run to run. A PC much busier than 3 runs at once could still pass 15 s on a file's first test.

## Review

- Round 1 (PR #116): no bugs. The reviewer confirmed the race on all six edit pages and the separate question load on the cover letter form. It found no test with the same pattern left out, and confirmed "Save" is the only button with that name on those pages. Applied: the count above now says 12 places plus the cover letter test (13 tests), matching the commit message.
- Round 2: no findings. The Save waits cannot match before the form loads, the cover letter list appears only after the questions load, and the counts and the `setup.ts` comment match the measurements.
