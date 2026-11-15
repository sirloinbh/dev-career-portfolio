# Dev Career Portfolio specific instructions

This file holds the rules that apply only to dev-career-portfolio. The shared instructions are in [AGENTS.md](AGENTS.md), which becomes a centrally managed file after the central standards (`sirloinbh/project-standards`) sync. If the two files differ, this file wins.

## Work procedure (in addition to the shared procedure)

- **After you open a PR, review it yourself 1 or 2 times (more only while blocking findings remain, per std-code-review section 8). Fix findings on the same branch in additional commits between rounds, and post each round as a PR comment. If there are no findings, go straight to the next step. File a new issue card for a big problem outside this PR's scope instead of growing the PR. After that, once all required CI checks on the final head pass, the agents (the main agent and the local worker) merge with a merge commit without asking the user.** The detailed review procedure follows section 5 of the implementation skill. Run `pr merge <url> --merge --match-head-commit <the head SHA you checked>` with the project wrapper and confirm that the linked issue is closed. Merge consecutive and stacked PRs in order: after the earlier PR merges, merge `origin/main` into the next PR's branch and resolve conflicts, re-run the related tests, push normally (no force), confirm CI passes, and then merge. Do not merge a PR that has a failing or running check, bypass branch protection or use `--admin`, replace review by approving your own PR, push directly to `main`, or force push. In this project a `main` merge does not trigger an automatic deploy (the sub-repositories are synced only on request).
- **Merge guards (project-standards ADR-0016):** if the PR's "Check before merging" lists an item that needs the user's own decision, ask the user and do not merge. Merging is not applying: real production or AWS changes (for example `terraform apply` or a manual deploy action) still need the user's OK.

## Project-specific skills

- [dev-career-portfolio-implementation](skills/dev-career-portfolio-implementation/SKILL.md), [dev-career-portfolio-testing](skills/dev-career-portfolio-testing/SKILL.md), [dev-career-portfolio-foundation](skills/dev-career-portfolio-foundation/SKILL.md): These contain this project's review and merge procedure, so keep them even after the shared skills (std-*) arrive.

## Service rules

- None yet. When a domain rule that applies only to this project appears, write it here.
