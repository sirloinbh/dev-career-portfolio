---
name: dev-career-portfolio-foundation
description: Establish or improve the repeatable development foundation of the dev-career-portfolio app, covering stack, structure, conventions, API contracts, design, tests, AI guidance, and deployment. Use for project foundation requests; apply only the requested scope through the dev-career-portfolio-implementation issue-to-PR workflow.
---

# Dev Career Portfolio development foundation

Make how this app is developed, verified, and operated repeatable. First read `AGENTS.md` at the project root and `skills/dev-career-portfolio-implementation/SKILL.md`, then follow this procedure: issue → number-based branch → implementation and docs record → tests and PR → automatic code review (at most 2 rounds) → agent merge after CI passes. This skill does not skip the issue and PR procedure or grant deploy permission, and merging follows the conditions in the implementation skill.

## Baseline

- The baseline document is `docs/project-setup.md`. Check the current package.json, lockfile, API and SQL, Compose, and CI, and separate what is actually implemented from what is only recommended (not adopted). Do not install the whole recommended list automatically.
- There is a single user, and login is not in the current requirements. Dates are in Asia/Seoul time.
- When you change or add a tool, first write down the real problem, the effect on data, and how to verify it. Install packages only after the user reconfirms.

## Steps

1. Settle the current state and the issue's completion criteria, and record the reasons for the choice, the structure, and the contract in the docs.
2. Keep tool settings, run commands, CI, and docs in line in the same change. Do not create unused settings, scripts, or empty modules.
3. For API and DB changes, preserve the meaning of existing data, dates, and units, and verify how migrations are applied and how to recover from a failure. Settle on one source for DB migrations.
4. For screen changes, keep the design tokens (the CSS variables in `frontend/src/style.css`) and the existing components, and cover loading, empty results, errors, and keyboard access within the affected scope.
5. Apply `skills/dev-career-portfolio-testing/SKILL.md` together with this one. Write the implementation and its tests together, add a regression test for each bug, and record the actual results in the docs and the PR.
6. Deploy only within the scope the user requested. Prepare the image version, health check, secret management, backup and restore, and recovery to the previous version.
7. Include the docs record in each work commit and open a verified PR. After the PR, go through automatic code review at most 2 times, apply the findings in additional commits, and split large fixes into a new issue card. Once all required CI checks on the final head pass, merge with a merge commit as the implementation skill describes.

## Completion criteria

A fresh environment must be able to reproduce install, run, and verification from the docs, and the chosen tools must show up in the real code, commands, and CI. Name tools not yet installed, checks that were skipped, and deploys that were not actually done as follow-up work.
