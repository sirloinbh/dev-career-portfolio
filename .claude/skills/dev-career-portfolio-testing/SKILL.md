---
name: dev-career-portfolio-testing
description: Write or update behavior-focused tests with dev-career-portfolio implementations and fixes, run them before commits and PR creation or updates, and record actual results. Use with dev-career-portfolio-implementation; for documentation-only changes validate the changed artifacts instead of adding unrelated app tests.
---

# Dev Career Portfolio: writing and running tests

Follow the project's AGENTS.md and the dev-career-portfolio-implementation procedure together with this skill. This skill is the standard for writing and running tests. It keeps the issue, branch, docs, and PR procedure, and the policy of automatic code review after the PR (at most 2 rounds) → agent merge after CI passes.

## Write tests together with the implementation or fix

- When you implement a feature or change behavior, add or update test code that verifies the requirement, and put the implementation and the tests in the same work commit. Running the existing tests does not replace verifying the new feature.
- For a bug fix, add a regression test that catches the bug if it comes back. When possible, confirm that it fails before the fix and passes after it. If you cannot reproduce the bug, record that limit.
- For a refactor, verify that existing behavior is preserved. If the related tests are enough, keep them as they are, but fill in scenarios that are missing.
- Verify results the user can see and domain rules, rather than tests that only repeat the internal implementation. Choose the normal path plus the input errors, boundaries, and failure paths that relate to the change.
- Choose unit tests for business logic, integration tests for the API, DB writes, and transactions, and component or browser tests for screen input and save flows. Do not add every kind of test to every change.
- Check the test tools and commands that are installed now. Do not report that you used tools not yet adopted, such as Vitest or Playwright, as if they were installed.
- Keep test data separate from production and user data. Write checks that depend on time, dates, or random values so they verify the same meaning when the environment changes.

## Before committing

- Check the changes and tests in the final commit, and actually run the related tests. Put the implementation, tests, and docs record in the same commit.
- Record the test code paths, the behavior you verified, and the commands and results in the matching issue record in docs/changes.
- Do not make a failing test pass by skipping or deleting it or by weakening its assertions. Fix the failure and then commit.
- If you cannot prepare the required environment, record that you did not run the tests. Do not report unverified work as done, and hand over a PR with remaining verification as a draft.

## Before creating or updating a PR

- Run the related tests and the project's required checks on the final diff and confirm they pass. If nothing changed after the commit and the result for the same target is still valid, you do not need to repeat the same checks.
- Record in the PR the tests you added or changed, the commands, pass/fail/skip, and the reason for anything not run. Do not count integration tests skipped because the DB environment variable is not set as passed.
- If you fix code or tests after the PR, re-run the affected checks and update the results in the docs and the PR. Also fix CI failures.
- If only docs, skills, or formatting changed and app behavior did not, verify with the validator, format, and link checks for those files, and write why you did not add app tests. A behavior change in executable code or check scripts includes related tests or a run verification.
- Include related tests in review fix commits too, and re-run the related tests on the last commit. Merge only a PR whose required CI checks on the final head all pass, following the implementation skill. Do not merge if any check fails or is still running.
