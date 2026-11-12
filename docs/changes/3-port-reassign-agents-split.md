# #3 Change the ports to the central standard (slot 08) and split out the AGENTS project-specific rules

- Issue: https://github.com/sirloinbh/dev-career-portfolio/issues/3
- Central tracking issue: https://github.com/sirloinbh/project-standards/issues/99

## Purpose

- Apply the ports that the central registry reassigned so that the ports of the 8 apps do not overlap (project-standards ADR-0006).
- Before the first central standards sync turns AGENTS.md into the shared instructions, move this project's PR review and merge rules into AGENTS.project.md to keep them.

## Changes

| Kind                       | Before | After         |
| -------------------------- | ------ | ------------- |
| Web                        | 8098   | 8108          |
| API                        | 3018   | 3108          |
| Vite                       | 5178   | 5208          |
| Host DB                    | 55448  | 15408         |
| e2e API and web (reserved) | none   | 3208 and 5308 |

- Files where the ports changed: `.env.example`, `README.md`, `backend/Dockerfile`, `backend/src/server.ts`, `compose.yaml`, `frontend/nginx.conf`, `frontend/vite.config.ts`, `AGENTS.md`
- Moved step 5 of `AGENTS.md` (the automatic code review and merge rules) word for word into "Work procedure" in `AGENTS.project.md`, and made `AGENTS.md` require reading that file.
- Did not edit the past records in `docs/changes/`, `docs/daily/`, and `docs/next-steps/`, because they describe the state at that time.

## What the user does

- In the local `.env`, change the port in `DATABASE_URL` from `55448` to `15408`, and `PORT` from `3018` to `3108`. Do not commit `.env`.

## Verification

- 2026-10-22: the results are written in the PR body.
