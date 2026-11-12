# Initial development environment setup (before issues)

- Date: 2026-10-19 (Asia/Seoul)
- Baseline: workout-memo's [development environment setup document](../project-setup.md) (workout-memo PR #57)

## Purpose

Prepare the development environment, a minimal app, verification, and repositories so the dev-career-portfolio project can be developed issue by issue. Detailed features go ahead after the user registers issue cards.

## Contents

- Stack: React 19 + Vite + TypeScript, Express 5 + pg + Zod, PostgreSQL 17, npm workspaces, Docker Compose, GitHub Actions. Node 24.21.0 / npm 11.19.0.
- Dependencies: used only the same packages and versions as workout-memo's lockfile (only the workspace names changed). With the user's approval, installed with `npm ci --ignore-scripts` and added no new packages. `npm audit`: 0 vulnerabilities.
- Minimal app: `GET /api/health` (DB check, service date), Korean 404 and 500 error handling, a sidebar, a page header, a status display, an empty-state screen, and design tokens based on CSS variables.
- DB: `database/migrations/001_initial.sql` (`app_settings`, safe to run again). For an existing DB, only the `psql -f` method is documented.
- Tests: unit (`health.test.ts`), DB integration (`db.integration.test.ts`, skipped without `TEST_DATABASE_URL`), UI (`app-ui.test.ts`, vm harness), and the skill sync check.
- AI instructions: `AGENTS.md`, `CLAUDE.md`, and three skills (source in `skills/`, copies in `.claude/skills/`).
- Repositories: the umbrella `sirloinbh/dev-career-portfolio` + the deploy sub-repositories `dev-career-portfolio-frontend`, `dev-career-portfolio-backend`, and `dev-career-portfolio-db` (private, subtree). AWS uses the shared `shared-aws-infrastructure`.

## Verification

- Applied the migrations in UTF-8 to the dedicated test DB `dev_career_portfolio_test` (workout-memo's test container) and ran `npm run check`: **exit 0**.
  - App and DB tests **8 pass / 0 fail / 0 skip** (the DB integration tests actually ran)
  - Skill check **4 pass / 0 fail / 0 skip**
  - Format, lint, and types passed, and the frontend and backend builds passed
- The real browser check was done in study-log, which was made from the same template (no horizontal scroll at mobile 390px, status and menu switching worked, PC 1440px worked). This project differs only in title and ports, and was checked with the UI test.
- The initial commit was pushed directly to `main` to create the repositories. From then on, every change goes issue → branch → PR.
- The Docker image build is checked by the `docker-build` job in GitHub Actions. `docker compose up` was not run locally.
