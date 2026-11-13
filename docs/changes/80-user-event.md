# #80 Bring a key input imitation tool (user-event) into the screen tests

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/80> (parent issue #69, cleaning up tests and development tools)

## Purpose

Imitate real key input such as Tab and Enter in the screen tests, and check "typing and saving with only the keyboard" with a test. In the first review of #47 (PR #79), it was pointed out that the keyboard test does not send keys. The repository had no tool, so it checked only the field order and the position of the submit button, and the user approved installing one on 2026-11-05.

## Changes

- `frontend/package.json`, `package-lock.json`, `frontend/package-lock.json`: added the development dependency `@testing-library/user-event` 14.6.8.
  - The version is pinned (`save-exact`).
  - Install scripts were not run (`ignore-scripts`).
  - This is the only new package that came in. The license is MIT.
- `frontend/src/certification-form.test.tsx`: added a "type and save with only Tab and Enter" test.
  - Pressing Tab on the "자격증 목록" (Certification list) link right above the form goes to the certification name field.
  - After that it types text into each field and moves on with Tab. At each Tab it checks that focus is on the next field.
  - It moves past the expiry date field while leaving it empty. Pressing Enter in the score or grade field saves.
  - It first checks that the save request went exactly once, and then checks the body that was sent. The expiry date is `null`.
  - I kept the existing structure tests (the field order, the submit button inside the form). If the keyboard test fails, they tell which precondition broke.

## Decisions

- **Version:** 14.6.8 was published on 2026-10-13, 23 days ago. It is past the "14 days since publication" standard this repository follows when bringing in packages. `@testing-library/dom` (`>=7.21.4`), which must be used with it, already has 10.4.2.
- **Scope:** this time it is used only in the certification form. Spreading keyboard tests to the education, career, project, and skill forms is outside the issue's scope.
- **Date field:** the date input in the test environment (jsdom) is a single field, so it types `2023-06-23` in one go. In real Chrome the year, month, and day fields must be moved with digit and arrow keys. I checked this behavior in the browser in #47.

## Verification

- I ran it with the submit button briefly moved outside the form. The new keyboard test failed because Enter did not save. I reverted the code to the original.
- `npm run check` (`TEST_DATABASE_URL`=Docker PostgreSQL 17 `career_test`): passed (exit code 0). Backend: 87 passed and 0 skipped. Frontend: 192 passed and 2 skipped (the existing theme-conditional tests). Skill check: 4. Build: passed.
- `npm run knip`: passed (the new package is really used in a test).
- `npm install`: 0 vulnerabilities (`found 0 vulnerabilities`).

## CI result of the first commit and the fix

At `1770431`, CI `verify` failed. CodeQL passed.

- **Cause:** the frontend Docker build runs `npm ci` with only the `frontend/` folder. But `frontend/package-lock.json` in that folder did not have the new package (`Missing: @testing-library/user-event@14.6.8 from lock file`).
- **Reason:** so that the sub-folders build on their own, `frontend/` and `backend/` each have their own lockfile (`docs/project-setup.md`). Running `npm install` at the root changes only the root lockfile.
- **Fix:** I brought `frontend/package-lock.json` in line with the root lockfile with `npm run lockfiles:sync`. In check mode (`node .standards/lockfiles.mjs`), both sub-lockfiles printed "루트 lockfile과 같습니다" (the same as the root lockfile).
- **Why I missed it locally:** the local `npm run check` does not include the Docker build and the lockfile check.

## First review applied

There was no defect. What the review confirmed is below.

- The lockfile change is minimal, and the integrity value is the same as the npm registry.
- I ran the test 3 times and all passed.
- If the submit button is changed to `type="button"` or the order of two fields is changed, the new test fails.

2 low findings were applied.

| Finding                                                                                                   | Applied                                                                                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| If Enter does not save, it waits 8 seconds and then fails with "title not found", so the cause is unclear | It now first waits until the save request (POST) went exactly once                          |
| The document said "the body sent last" but the code looks at the first POST                               | Fixed the document to "the body that was sent". The test checks that the POST happened once |

- After applying it, the 17 certification form tests passed, and the static checks (format, lint, types) passed. The Docker build needs a package authentication token, so it is confirmed by the CI result.

## Second review result

There was no defect. What the review confirmed is below.

- The entry added to `frontend/package-lock.json` (the version, the download address, the integrity value, and the development dependency flag) is the same as the root.
- `@testing-library/dom`, which must be used with it, is already in that lockfile.
- In a place where only the `frontend` files were copied temporarily, I ran `npm ci --dry-run --ignore-scripts` and it passed. However, the real download and package authentication are confirmed only in CI.

Reviews end at 2. No issue was split off.
