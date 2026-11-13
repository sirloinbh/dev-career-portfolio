# 91 Translate past records in docs to English

Issue: https://github.com/sirloinbh/dev-career-portfolio/issues/91 (tracking: sirloinbh/project-standards#487)

## Purpose

The change records and daily logs under `docs/` are English.

## Changes

- Translated every Korean file under `docs/changes/` (`bootstrap.md`, `README.md`, and the records for #1, #3, #10, #27, #31 to #48, #57, #58, and #80) and under `docs/daily/` (`README.md` and `2026-10-19.md`). There is no `docs/adr/` folder in this repository.
- Kept headings, numbers, commit SHAs, file paths, commands, and image links as they were.
- Kept quoted UI text, API and validation messages, and fixture data (made-up names such as a school name) in Korean, each with an English gloss in parentheses, because they must match what the app shows.
- In `1-agent-auto-merge.md`, the grep patterns for the old Korean policy wording are described in English instead of quoted.

## Verification

See the PR for the commands and results.
