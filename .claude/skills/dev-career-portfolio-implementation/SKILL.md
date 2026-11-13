---
name: dev-career-portfolio-implementation
description: Follow the user's issue, numbered branch, implementation with docs, tests, and PR workflow for changes to the sirloinbh dev-career-portfolio project. Use for code, configuration, documentation, and skill edits; exclude read-only questions and recommendations. Review each PR at most twice with fix commits, split large fixes into new issues, then merge with a merge commit once all required CI checks pass.
---

# Dev Career Portfolio implementation procedure

This skill applies to change work in `sirloinbh/dev-career-portfolio`. Do not apply this account, repository, or policy to other projects. First read `AGENTS.md` at the project root and the related docs. Follow the order below, and deliver as the result a PR that passed automatic code review (at most 2 rounds) and the required CI checks and was merged.

## 1. Register the issue card

- Check the GitHub remote URL and `gh api user --jq .login`. The expected account is `sirloinbh`. If it is another account, do not make remote changes until you fix the authentication.
- Reuse the issue the user named, or an issue already registered for the same request. Before a retry, check the existing result so you do not create a duplicate issue.
- In a new issue, write the problem and purpose, the requested scope, the completion criteria, and the verification method. In this project an issue card means a GitHub Issue. Do not create or link a board unless a separate Projects board was named.
- Write the body as a UTF-8 temporary file and register it with `gh issue create --repo sirloinbh/dev-career-portfolio --title ... --body-file ...`. Do not put tokens or secrets in the body.
- Keep the real issue number and URL that were issued. If the issue registration fails, do not invent a number or start code changes first.

## 2. Create a branch with the issue number

- Check the working tree and the current branch. If there are changes from other work, preserve them and avoid mixing work.
- The default target branch is `main`. Do not start new work from an unrelated unmerged work branch. Fetch the remote main in a clean working tree and branch from it. If there are user changes, prepare a workspace that preserves them.
- Branch name: `<type>/<number>-<short-slug>`. Examples: `feat/12-first-feature`, `fix/13-goal-date`, `docs/14-project-skills`, `chore/15-ci`.
- If a branch for the same issue already exists, check its state and keep using it.
- Make changes and commits on this branch. Do not commit or push directly to `main`.

## 3. Implementation and a docs record for each commit

- When you implement or fix something, read the project's `skills/dev-career-portfolio-testing/SKILL.md` and write or update the related tests together. For a bug fix, add a regression test. Put the implementation, tests, and docs in the same work commit, and run the related tests before committing.
- Implement only the requested scope. For development foundation work, read `dev-career-portfolio-foundation` too.
- Create `docs/changes/<number>-<slug>.md` and record the issue link, the purpose, the changes, the verification, and the limits and follow-up work.
- **Record in the docs, in each work commit, the changes and verification done in that commit.** You may accumulate entries in one issue document. A commit that changes only docs also updates the matching work record.
- In the record, write the reason for the change and the observed results. Do not write that a check or deploy you did not run is done. You do not need to create a SHA that points at the commit itself in advance. Tell entries apart by commit title or unit of work.
- The commit title includes the type and the issue number, such as `feat: ... (#12)`, `fix: ... (#13)`, `docs: ... (#14)`.
- Before staging, check the diff and whether it contains secrets, and stage only the related files, by name. Do not include another user's changes.

## 4. Create the PR after tests

- Before you create or update a PR, run the related tests and the required checks on the final changes. Record in the docs and the PR the test code you added or changed, the behavior you verified, and the commands you actually ran with pass/fail/skip. Follow the project `AGENTS.md` for the required commands and the DB integration test conditions. Do not add app tests that a plain docs or skill change does not need.
- Fix failures, and record in the docs and the PR separately the checks you could not run, the DB tests that were skipped, and the browser verification that is not done. If needed verification is blocked, make the PR a draft.
- Push only the work branch. The PR target is `main` of `sirloinbh/dev-career-portfolio`. The subtree sync script pushes main and the sub-repositories, so do not use it in this step.
- If a PR for the same head branch exists, update it and do not create a duplicate.
- Pass the PR body as a UTF-8 file. Include the problem and the behavior after the change, the main changes, the actual check commands and results, evidence for screen changes where possible, and `Closes #<number>`. If there are no images, write why and the limits of the verification.
- Check the GitHub Actions results and fix related failures. Say that a check still running is running. If you changed code after creating the PR, re-run the affected checks and update the docs and PR results.

## 5. Automatic code review after the PR (at most 2 rounds)

After you open the PR, it goes through automatic code review at most 2 times. Apply review findings in additional commits, and get a second review after the first round of fixes. Do not review further after the second round of fix commits. If there are no findings, go straight to the next step. Split any fix too large for this PR into a new issue card.

1. **First review:** after opening the PR, run a read-only review separate from the authoring context (a separate agent, a review tool, and so on). Look at correctness, regressions, security, missing tests, and the docs record, against the issue's completion criteria and the whole PR diff.
2. **If there are no findings,** end the review and move on to the CI check and the merge.
3. **If there are findings,** apply only the findings that can be fixed within this PR's scope. Make an additional commit that includes the related tests and the docs record, and push it.
4. **Second review:** check that the first round's findings were applied and look at the added diff. Also look at the whole final PR diff. If there are no findings, move on to CI.
5. **Second round of fixes:** apply the second round's findings in an additional commit. Reviews are at most 2, so do not run a third review; move on to CI.
6. **Split large fixes:** do not fix the following kinds of findings in this PR. Instead, create a new issue card (with the problem, scope, and completion criteria) in `sirloinbh/dev-career-portfolio`. Leave the issue link in a PR comment and in the docs record, and keep this PR going.
   - A feature outside the requested scope
   - A design or data structure change
   - A fix across several modules
   - Work that needs separate verification
7. **Hold the merge:** if the following defects remain, do not merge and tell the user.
   - A defect that breaks main if split off
   - A defect with a security or data corruption risk
8. **Record:** leave the result of each review round in a PR comment and in the docs work record. Write the findings, the commits that applied them, the issues split off, and whether there were no findings.
9. **Merge after CI:** re-run the related tests on the last commit. Once the required CI on the final head all passes, merge with that SHA (section 6). If a new commit appears during review, do not merge on the earlier CI result.

## 6. Merge after CI passes

- **After the automatic code review (section 5), once all required CI checks on the final head pass, the agents (the main agent and the local worker) merge with a merge commit without asking the user.** Right before merging, check the PR head SHA and run `pr merge <url> --merge --match-head-commit <the head SHA you checked>` with the project wrapper.
- After merging, check that the linked issue is closed, and report the issue URL, the branch name, the PR URL, the merge commit, the verification results, and the remaining work.
- Merge consecutive and stacked PRs in order. After the earlier PR merges, merge `origin/main` into the next PR's branch and resolve conflicts, re-run the related tests, push normally (no force), confirm CI passes, and then merge.
- **Prohibited:** merging a PR that has a failing or running check, bypassing branch protection or using `--admin`, replacing review by approving your own PR, pushing directly to `main`, and force pushing.
- In this project a `main` merge does not trigger an automatic deploy. Syncing the sub-repositories (`scripts/push-repositories.ps1`) happens only on a separate request.

## Authentication and failure handling

Do not recheck issue, push, and PR permissions that were already granted without need. Respect the run permissions the tools require and the GitHub authentication. On a failure, resume from the step you already completed, and if the result of a remote creation is unclear, look it up before retrying. Do not work around an account or authentication problem by creating things with another account.
