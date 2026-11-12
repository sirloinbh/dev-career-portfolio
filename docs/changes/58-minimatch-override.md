# #58 Resolve the minimatch vulnerability alert (force 11.x)

Issue: <https://github.com/sirloinbh/dev-career-portfolio/issues/58>

## Purpose

Resolve [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (medium severity). In `minimatch` below 11.0.1, when `optimizationLevel` is 2 or more, an attacker-made glob pattern can inflate the number of patterns in the preprocessing stage and use a lot of CPU and memory. This advisory first came up as Dependabot alert #7, but during the work GitHub withdrew alert #7 (`dependabot/alerts/7` returned HTTP 410 "Alert number 7 has been withdrawn"). The advisory itself is still valid (`withdrawn_at: null`). So whether it is resolved is checked with `npm audit`.

## Cause

- This repository had one copy of `minimatch@10.2.6` as a development dependency. `eslint`, `@eslint/config-array` (under eslint), `@typescript-eslint/typescript-estree` (under typescript-eslint), and `eslint-plugin-jsx-a11y-x` use it. Across the whole `node_modules`, these four are the only places that load minimatch.
- The fixed version exists only in 11.x, but even the latest versions of the packages above require `minimatch@^10` (eslint 10.14.0 `^10.2.6`, config-array 0.23.5 `^10.2.4`, typescript-estree 8.72.1 `^10.2.2`, jsx-a11y-x 0.2.0 `^10.2.5`). So just raising the packages does not resolve it.
- The real risk is low. None of the four packages sets `optimizationLevel`, so they run with the default 1 and do not pass through the vulnerable path, and the patterns are only ones this repository uses, such as the eslint settings.

## Changes

- `package.json`: with `overrides`, pin only the `minimatch` under `eslint`, `typescript-eslint`, and `eslint-plugin-jsx-a11y-x` to `11.0.4`. The centrally managed part of `package.json` is only the fixed fields, so this repository can decide `overrides` (`npm run standards:check` passed).
- `package-lock.json`: `minimatch` 10.2.6 → 11.0.4 (engines narrows from `18 || 20 || >=22` to `20 || >=22`, but it has no effect because Node is 24.21.0), and a new sub-dependency `@isaacs/nonrecursive-glob-match@1.0.3` (BlueOak-1.0.0, no dependencies or install scripts). The user refreshed it with `npm install --ignore-scripts` (an agent hook blocks install commands). The `frontend/` and `backend/` lockfiles do not have `minimatch`, so they did not change, and the Docker build that runs `npm ci` with those lockfiles is not affected.

## Decisions

- **Why I used an override:** I confirmed with the user (2026-11-04) to force 11.x instead of dismissing the alert.
- **Why I narrowed the scope to the eslint family:** if it were applied to the whole repository, when a package that uses minimatch 3, 5, or 9 (glob, a coverage tool, and so on) comes in later, it would silently get 11. 11.0 changes the `Minimatch.set` items from RegExp to `Matcher` and removes `makeRe()`, so such a package can break at run time, and `npm ls` does not catch it either.
- **Why I pinned the exact version (`11.0.4`):** `.npmrc` has `save-exact=true` and all the other development dependencies are exact versions too. minimatch has changed its matching behavior even in patch versions such as 10.2.3, so this keeps a different 11.x from silently coming in at the next `npm install`.
- **Compatibility of 11.0:** the four packages use only `new Minimatch(pattern, { dot: true[, flipNegate] })`, `.match(path[, partial])`, `.pattern`, and `minimatch(path, pattern[, { dot: true }])`. The changes in 11.0 and their effects are as follows.
  - Removal of `makeRe()`, `Minimatch#regexp`, `AST`, `debug`, `matchOne()`, and so on: none of the four packages use them.
  - `Minimatch.set` items are strings, `Matcher`, or `GLOBSTAR` instead of RegExp: nothing reads `.set`.
  - A path piece with an empty end such as `a/b/` matches only an empty pattern piece, and on Windows `..` does not remove the drive letter or the UNC prefix: nothing in the eslint config patterns matches this.
  - The bug fixes for patterns with several `**` and for `partial` matching: I compared directly, as below, whether eslint's file selection changes.
- **When to remove the override:** remove it when all of the eslint family accept `minimatch@^11`. So that I do not forget, I registered it as [#62](https://github.com/sirloinbh/dev-career-portfolio/issues/62).

## Verification

- `npm ls minimatch --all`: all four packages are `minimatch@11.0.4` (no 10.x). `npm ls --all` exit code 0 (no invalid dependency).
- `npm audit`: `found 0 vulnerabilities` (main's lockfile had 12 medium ones because of minimatch).
- `node .standards/lockfiles.mjs`: the `frontend` and `backend` lockfiles are the same as the root.
- **Before and after comparison of the eslint result:** in the same working tree I installed 10.2.6 and 11.0.4 in turn with `npm ci --ignore-scripts`, recorded with the same script, and compared with `diff -r`. The results were exactly the same.
  - The list of checked files: 85, the same (also the same excluding `.standards/**`).
  - eslint messages: 0 in both.
  - The rules and settings seen with `--print-config`: the same in 9 sample files (`frontend/src/app.tsx`, a screen test, `components/ui`, `test/setup.ts`, `backend/src/app.ts`, a backend test, `scripts/*.mjs`, `vite.config.ts`, `eslint.config.mjs`).
- **That it still catches errors:** on 11.0.4 I checked a temporary file that deliberately breaks rules and confirmed it catches `no-unused-vars`, `simple-import-sort/imports`, `jsx-a11y-x/alt-text`, `jsx-a11y-x/label-has-associated-control` (a rule that uses minimatch directly), `click-events-have-key-events`, and `no-static-element-interactions`, and then I deleted the file.
- `npm run check`: passed (exit code 0). Backend: 36 of 46 passed and 10 skipped (the DB integration tests were skipped because this PC has no PostgreSQL). Frontend: 87 passed and 2 skipped. Skill check: 4 passed. Build: passed.
- CI (first commit 4e25140): in `verify`, backend 46 passed and 0 skipped (including the DB integration tests), `npm run knip` (knip-strict) passed, and `docker-build` passed.

## First review applied

| Finding                                                                                                                                                 | Applied                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| (Low) `"minimatch": "^11.0.4"` applied to the whole repository, so a package that uses another version would silently get 11                            | Narrowed the scope to under eslint, typescript-eslint, and jsx-a11y-x                                                                 |
| (Low) The `^` range differs from the repository's convention of pinning exact versions (`save-exact=true`)                                              | Pinned to `11.0.4`                                                                                                                    |
| (Low) Dependabot alert #7 was withdrawn, so the completion criterion "alert #7 closes after the merge" cannot be checked                                | Changed the purpose and the completion check to be based on the advisory ID and `npm audit`, and recorded it in the #58 issue comment |
| (Low) The compatibility explanation lacked the `Minimatch.set` change and the empty path piece and Windows `..` changes. The risk explanation was vague | Wrote them item by item in Decisions, and wrote that the vulnerable path runs only at `optimizationLevel >= 2`                        |
| (Low) The knip limit was out of date (it passed in CI), and the date `oxc-resolver` came in was wrong. The engines change was missing                   | Fixed the Limits and Changes sections                                                                                                 |
| (Note) There is nothing that tells me when to remove the override                                                                                       | Split off as [#62](https://github.com/sirloinbh/dev-career-portfolio/issues/62)                                                       |

Verification of the narrowed override:

- The lockfile is unchanged and `npm ci --ignore-scripts` passes (0 vulnerabilities). `npm ls --all` exit code 0.
- That the override is really applied: running `npm ci --dry-run` with the new `package.json` and main's lockfile (10.2.6) is rejected with `Invalid: lock file's minimatch@10.2.6 does not satisfy minimatch@11.0.4`.
- `npm run check`: passed (exit code 0, the same counts as above). `npm run standards:check` passed, and the sub-lockfiles are the same as the root.

## Second review result

The result was that there were no findings. All first-round findings were applied, and I separately confirmed that the narrowed override covers all four packages.

- `@eslint/config-array` is reached only through `eslint`, and `@typescript-eslint/typescript-estree` only through `typescript-eslint`, and no package outside the three scopes uses minimatch.
- With npm 11.19.0's dependency calculation (`buildIdealTree`, without installing), I ran the cases of the lockfile as it is, recomputing with the minimatch entry removed, and the equivalent of `npm update minimatch`, and the single `node_modules/minimatch@11.0.4` was kept. Under the same conditions main's `package.json` computes to 10.2.6, so a later `npm install` or `npm update` also keeps 11.0.4.
- Note: because of the exact version pin, if a new advisory appears for 11.0.4 the override must be raised by hand. I wrote it in #62.

Reviews are at most 2, so no further review is done. This commit only added records (`npm run format:check` passed).

## Limits

- I could not run `npm run knip` on this PC. The Windows native module file of `oxc-resolver@11.24.2` exists, but it cannot be loaded with `The specified module could not be found` (the same family's `oxc-parser` loads). `oxc-resolver` has not changed in the lockfile since 2026-10-29 (967c082) and is unrelated to `minimatch`, so I treat it as a problem of this PC's environment. knip passed in CI `verify`.
