# Dev Career Portfolio specific instructions

This file holds the rules that apply only to dev-career-portfolio. The shared instructions are in [AGENTS.md](AGENTS.md), which becomes a centrally managed file after the central standards (`sirloinbh/project-standards`) sync. If the two files differ, this file wins.

## Work procedure (in addition to the shared procedure)

- **After you open a PR, it goes through automatic code review at most 2 times. Apply review findings in additional commits, and get a second review after the first round of fixes. Do not review further after the second round of fix commits. If there are no findings, go straight to the next step. Split any fix too large for this PR into a new issue card. After that, once all required CI checks on the final head pass, the agents (the main agent and the local worker) merge with a merge commit without asking the user.** The detailed review procedure follows section 5 of the implementation skill. Run `pr merge <url> --merge --match-head-commit <the head SHA you checked>` with the project wrapper and confirm that the linked issue is closed. Merge consecutive and stacked PRs in order: after the earlier PR merges, merge `origin/main` into the next PR's branch and resolve conflicts, re-run the related tests, push normally (no force), confirm CI passes, and then merge. Do not merge a PR that has a failing or running check, bypass branch protection or use `--admin`, replace review by approving your own PR, push directly to `main`, or force push. In this project a `main` merge does not trigger an automatic deploy (the sub-repositories are synced only on request).

## Project-specific skills

- [dev-career-portfolio-implementation](skills/dev-career-portfolio-implementation/SKILL.md), [dev-career-portfolio-testing](skills/dev-career-portfolio-testing/SKILL.md), [dev-career-portfolio-foundation](skills/dev-career-portfolio-foundation/SKILL.md): These contain this project's review and merge procedure, so keep them even after the shared skills (std-*) arrive.

## Service rules

- None yet. When a domain rule that applies only to this project appears, write it here.
