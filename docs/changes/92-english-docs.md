# 92 Translate the current docs to English

Issue: https://github.com/sirloinbh/dev-career-portfolio/issues/92 (tracking: sirloinbh/project-standards#487)

## Purpose

Every markdown file outside `docs/changes/`, `docs/daily/`, and `docs/adr/` is English.

## Changes

- Translated `README.md`, `database/README.md`, `AGENTS.project.md`, `docs/next-steps/README.md`, and `docs/project-setup.md`.
- Translated the project skills in `skills/dev-career-portfolio-*/SKILL.md` and refreshed the `.claude/skills/` copies with `node scripts/claude-skills.mjs sync` (the same step as `npm run skills:sync`).
- The heading anchors in `docs/project-setup.md` changed with the headings (for example `#11-bootstrap-checklist`). No other file links to them.
- Skipped centrally managed files (`AGENTS.md`, `skills/std-*`). The central repository translates them.
- Kept on purpose: the Korean brand example `'기타'` in `docs/project-setup.md` (it shows an encoding bug that turns Korean text into `?`).

## Verification

See the PR for the commands and results.
