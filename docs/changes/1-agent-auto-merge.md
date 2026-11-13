# #1 Change to the agent PR merge policy

- Issue: [#1](https://github.com/sirloinbh/dev-career-portfolio/issues/1)
- Date: 2026-10-21 (Asia/Seoul)

## Purpose

At the repository owner's request (2026-10-21), change the policy "only the user merges PRs" to "the agent merges with a merge commit when the required CI passes".

## Changes

- The merge policy sentences in `AGENTS.md` implementation step 5, the `README.md` order of work, and `docs/project-setup.md` (common principle 2, the Git strategy order and merge, the file roles table, and step 5 of the AGENTS.md template).
- The merge sentences in the source skills under `skills/`: implementation (the YAML description, the introduction, and all of section 5), foundation (the introduction and step 7), and testing (the introduction and the run standard). Refreshed `.claude/skills/` with `npm run skills:sync`.
- New policy: when all required CI checks pass, the agent (the main agent and the local worker) runs `pr merge <url> --merge --match-head-commit <the head SHA you checked>` with the project wrapper and confirms that the linked issue is closed. Consecutive and stacked PRs go in this order: after the earlier PR merges, merge `origin/main` and resolve conflicts → re-run the related tests → push normally → CI passes → merge.
- Still prohibited: merging a PR that has a failing or running check, bypassing branch protection or using `--admin`, replacing review by approving your own PR, pushing directly to `main`, and force pushing.
- In this project a `main` merge does not trigger an automatic deploy (CI only verifies and builds Docker, and the sub-repositories are synced only on request). This is written in the implementation skill and `AGENTS.md`.
- Changed the squash merge recommendation in `docs/project-setup.md` to the merge commit policy. Past records (`docs/changes/bootstrap.md`) are left as they are.

## Verification

- `PYTHONUTF8=1 python quick_validate.py skills/<skill>` (skill-creator, 3 skills): all `Skill is valid!`
- `npm run skills:check`: `.claude/skills matches skills/.`
- `npm run test:skills`: 4 pass / 0 fail / 0 skip
- `npx --no-install prettier --check AGENTS.md README.md docs skills .claude/skills`: passed
- A grep for the old policy wording (the Korean phrases for "user merge" and "only the user merges", `merging to the user`, `gh pr merge`, and so on, excluding `docs/changes`): nothing left
- The full local `npm run check` (lint, types, app tests, build) was not run. This checkout has no `node_modules`, and installing packages needs the user's reconfirmation. It is a docs and skill change with no app code change, and the full check is confirmed by GitHub Actions CI.

## 2026-10-21 — Automatic review after the PR (at most 2 rounds)

### Purpose

The repository owner asked to refine the merge policy. After opening a PR, it goes through automatic code review at most 2 times (review → fix commit → second review → fix commit). Fixes too large for this PR are split into a new issue card, and then the PR merges when the required CI on the final head passes. If the review has no findings, go straight to the CI check and the merge.

### Changes

- `skills/dev-career-portfolio-implementation/SKILL.md`: added "5. Automatic code review after the PR (at most 2 rounds)" between "4. Create the PR after tests" and the merge. It covers the first and second reviews, fix commits, no third review, the criteria for splitting a large fix into a new issue, the conditions to hold the merge, a record per round, and merging after CI on the final head. Renumbered the old merge section to "6. Merge after CI passes". Also changed the YAML description and the introduction to include the review step.
- Added a short summary to `AGENTS.md` implementation step 5, the `README.md` order of work, `docs/project-setup.md` (common principle 2, the Git strategy order, a new review item, the file roles table, and step 5 of the AGENTS.md template), the foundation skill (the introduction and step 7), and the testing skill (the introduction and the run standard).
- Kept the existing safety prohibitions (merging with a failing or running check, bypassing with `--admin` or protection, approving your own PR, pushing directly to `main`, and force pushing) and the handling of consecutive and stacked PRs.
- Refreshed `.claude/skills/` with `npm run skills:sync`. Past records (`docs/changes/bootstrap.md`) were not edited.

### Verification

- `npm run skills:check` after `npm run skills:sync`: `.claude/skills matches skills/.`
- `npm run test:skills`: 4 pass / 0 fail / 0 skip
- `PYTHONUTF8=1 python quick_validate.py skills/<skill>` (codex skill-creator, 3 skills: implementation, foundation, and testing): all `Skill is valid!`
- `npx --no-install prettier --check AGENTS.md README.md docs skills .claude/skills`: passed
- Lint, typecheck, app tests, and build (the full `npm run check`) were not run. This checkout has no `node_modules`, and `AGENTS.md` makes package installs subject to the user's reconfirmation. It is a docs and skill change with no app code change, and the full check is confirmed by GitHub Actions CI.
