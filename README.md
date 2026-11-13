# Dev Career Portfolio

A personal portfolio service that organizes development career history, projects, and technical growth. There is a single user, and the service runs locally without login.

## Development baseline

Node.js **24.21.0**, npm **11.19.0**. Install with `npm ci --ignore-scripts` (after user confirmation), format with `npm run format`, and run the full verification with `npm run check`. The full baseline is in the [development environment setup document](docs/project-setup.md) and [AGENTS.md](AGENTS.md).

Changes go in this order: **GitHub issue → branch named with the issue number → implementation, tests, and a docs record → `npm run check` → PR → automatic code review (at most 2 rounds; split large fixes into a new issue) → agent merge (merge commit) after CI passes**.

## Run

```powershell
Copy-Item .env.example .env
docker compose up --build -d
```

Open http://localhost:8108 . Change the password in `.env` before you run it. Data is stored in the `dev-career-portfolio-data` volume, and `docker compose down -v` deletes the data.

Development run:

```powershell
docker compose up -d db
npm run dev
```

Vite http://localhost:5208, API http://localhost:3108/api/health, host DB port 15408.

## Verification

- `npm run check`: format, lint, types, tests, skill sync check, build.
- The DB integration tests need `TEST_DATABASE_URL` pointing to a dedicated test DB with the migrations applied. They are skipped without it.
- GitHub Actions runs the full check with a PostgreSQL service and builds the Docker image.

## Repository layout

This repository is an umbrella monorepo that holds all the source. `frontend`, `backend`, and `database` are synced with `git subtree split` to the private deploy repositories `dev-career-portfolio-frontend`, `dev-career-portfolio-backend`, and `dev-career-portfolio-db` (`scripts/push-repositories.ps1`, only on request). AWS infrastructure is managed in the shared repository `shared-aws-infrastructure`.

## Docs

- [AI instructions](AGENTS.md) · [Claude instructions](CLAUDE.md) · [DB](database/README.md)
- [Change records](docs/changes/README.md) · [Daily records](docs/daily/README.md) · [Next steps](docs/next-steps/README.md)
