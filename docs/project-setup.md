# New web app project setup: handoff document for AI agents

Hand this document as it is to the **AI agent that will set up a new web app project** (Claude Code, Codex, and so on). It is based on the development environment that `sirloinbh/workout-memo` actually runs and has verified. The agent reads the whole document and then follows the [11. Bootstrap checklist](#11-bootstrap-checklist) in order.

- Reference date: 2026-10-19 (Asia/Seoul). The version numbers are the values whose real behavior was checked on that day. When you start a new project, check the official support status again and record the reason if you change a version.
- Labels: **[Applied now]** means installed and used in workout-memo today. **[Recommended, not adopted]** means reviewed but not installed yet. Do not treat a tool that is not adopted as if it were installed.

## 0. Values to confirm with the user before you start

The placeholders below differ per project. If a value is not settled, **ask the user before you start the setup.** Do not choose it yourself.

| Placeholder               | Meaning                                                          | workout-memo example                                                               |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `<app>`                   | Base name of the app and repository (lowercase, hyphens)         | `workout-memo`                                                                     |
| `<App display name>`      | Name used on screen and in docs                                  | `FORM · My workout log`                                                            |
| `<owner>`                 | GitHub account (personal or organization)                        | `sirloinbh`                                                                        |
| `<db>`                    | PostgreSQL DB and user name                                      | `workout`                                                                          |
| `<web-port>`              | Local web port for the production-style run (bound to 127.0.0.1) | `8088` (avoids clashes with common ports such as 8080)                             |
| `<db-port>`               | DB port used from the host                                       | `55432` (avoids a clash with the default 5432)                                     |
| `<api-port>`              | Internal API port                                                | `3001`                                                                             |
| `<timezone>`              | Service time zone                                                | `Asia/Seoul`                                                                       |
| `<region>`                | AWS region                                                       | `ap-northeast-2` (Seoul)                                                           |
| `<budget-usd>`            | Monthly AWS budget alert threshold                               | `20`                                                                               |
| Users and login           | Number of users, whether login is needed                         | Single user, no login → never expose it to the public                              |
| Domain rules              | Core rules such as dates, units, and unconfirmed values          | Dates `YYYY-MM-DD`, weight is total weight in kg, unconfirmed values are NULL      |
| GitHub account separation | Whether work and personal accounts are mixed                     | The default `gh` is the work account; this project uses a personal-account wrapper |

## 1. Absolute rules (limits on agent behavior)

Copy these as they are into the new project's `AGENTS.md`.

1. **Install or remove npm packages only after the user reconfirms.** The 2025-2026 npm supply chain attacks (the Shai-Hulud family) steal tokens through `postinstall` hooks. This covers `npm install/i/add/uninstall/update/ci`, `npx <package>`, `pnpm/yarn/bun install`, and `corepack enable/prepare`. If an install is needed, follow this order.
   - Show the user the package list with the publisher, the latest release, and the GitHub repository, and recommend checking socket.dev, Snyk Advisor, and deps.dev.
   - Run it only when the user says explicitly "I understand the risk, go ahead". Suggest `--ignore-scripts` first.
   - List only the packages whose build really needs an install script (for example `esbuild`) in `allowScripts` in `package.json`.
   - Commands that do not install anything, such as `npm run <script>`, `npm ls`, and `npm view`, are allowed.
2. **After you open a PR, it goes through automatic code review at most 2 times. Apply review findings in additional commits, and get a second review after the first round of fixes. Do not review further after the second round of fix commits. If there are no findings, go straight to the next step. Split any fix too large for this PR into a new issue card. After that, once all required CI checks on the final head pass, the agent merges without asking the user.** The main agent and the local worker run `pr merge <url> --merge --match-head-commit <the head SHA you checked>` (merge commit) with the project GitHub wrapper and confirm that the linked issue is closed. For consecutive and stacked PRs, after the earlier PR merges, merge `origin/main` into the next PR's branch and resolve conflicts, re-run the related tests, push normally (no force), confirm CI passes, and then merge. Do not merge a PR that has a failing or running check, bypass branch protection or use `--admin`, replace review by approving your own PR, push directly to `main`, or force push. If a `main` merge triggers a deploy in the project, also check the deploy result after the merge.
3. **Never put secrets in the repository, docs, PRs, or logs.** This covers `.env`, tokens, real backups, and Terraform state. Commit only `.env.example`.
4. **Do not overwrite user changes.** Do not use `git add -A`; stage files by name. Check the target before you revert or delete anything.
5. **Do not report a check you did not run as passed.** Record skipped DB tests, browser checks not done, and things not deployed separately.
6. **Ask when requirements are missing.** For rules that must be settled before implementation (aggregation method, policy, scope), confirm them with the user together with a recommendation and record them in the issue.

## 2. Language and docs rules

- Write user conversation, screen text, and docs (README, docs, issues, PRs) in **Korean**. Code identifiers, commit title prefixes (`feat:` and so on), and code comments default to English.
- Also write server validation error messages in Korean when the user can see them. Give a message such as `.min(1, '…')` so that Zod's default English messages ("Array must contain…") do not show on screen.
- Dates are `YYYY-MM-DD`, and the service time zone is `<timezone>`. Compute the server's "today" in the service time zone, not the server's time zone.
- Where docs go:
  - `docs/changes/<issue-number>-<slug>.md`: the change record for each issue. Record the purpose, the changes, the actual verification commands with pass/fail/skip, and the limits.
  - `docs/daily/YYYY-MM-DD.md`: the summary of a working day. Accumulate by date and add the entry to the list in `docs/daily/README.md`.
  - `docs/next-steps/README.md`: the latest priorities, blockers, and next actions. Update it every day.

## 3. Tech stack

### 3.1 [Applied now] Versions and roles

| Area            | Choice                                              | Version (pinned/range)                                     | Role                                                   |
| --------------- | --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Runtime         | Node.js / npm                                       | `24.21.0` / `11.19.0` (pinned exactly)                     | The same in development, CI, and Docker                |
| Package layout  | npm workspaces                                      | Root + `frontend`, `backend`                               | One root lockfile + lockfiles for the sub-repositories |
| Frontend        | React, React DOM                                    | `^19.1.0`                                                  | SPA                                                    |
|                 | Vite                                                | `^6.3.5`                                                   | Dev server and build, `/api` proxy                     |
|                 | TypeScript                                          | `^5.8.3`                                                   | `strict`                                               |
|                 | lucide-react                                        | `^0.468.0`                                                 | Icons                                                  |
| Backend         | Express                                             | `^5.1.0`                                                   | REST API                                               |
|                 | pg (node-postgres)                                  | `^8.16.0`                                                  | Hand-written SQL, no ORM                               |
|                 | Zod                                                 | `^3.25.0`                                                  | Server input validation                                |
|                 | tsx                                                 | `^4.19.0`                                                  | Dev run (`watch`) and test run                         |
| DB              | PostgreSQL                                          | `17` (`postgres:17-alpine`)                                | A single DB                                            |
| Web server      | nginx                                               | `1.27-alpine`                                              | Static files + `/api` reverse proxy                    |
| Code quality    | ESLint / typescript-eslint / react-hooks / Prettier | `10.12.0` / `8.71.2` / `7.1.1` / `3.9.10` (pinned exactly) | Warnings also fail                                     |
|                 | `@eslint/js`, `eslint-config-prettier`, `globals`   | `10.0.1`, `10.1.8`, `16.5.0`                               |                                                        |
| Dev convenience | concurrently                                        | `^9.2.0`                                                   | Run the API and web together                           |
| Tests           | `node:test` + `tsx --test`                          | Built into Node                                            | Unit, DB integration, UI (chapter 6 below)             |
| Containers      | Docker Compose                                      | —                                                          | 3 services: db, api, web                               |
| CI              | GitHub Actions                                      | —                                                          | Full check + DB integration + Docker build             |
| Infrastructure  | Terraform / AWS provider                            | `>= 1.6.0` / `~> 5.0`                                      | ECR and budget alerts (deploy not connected)           |

### 3.2 [Recommended, not adopted] Candidates to adopt when needed

| Area         | Candidate                                 | When to adopt                                                                                          |
| ------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Routing      | React Router                              | When there are more than 4-5 screens and URL sharing and the back button are needed                    |
| Server state | TanStack Query                            | When fetch, cache, and refresh-after-save code starts to repeat                                        |
| Forms        | React Hook Form + Zod                     | When array inputs and per-item errors get complicated                                                  |
| UI           | Tailwind CSS + shadcn/ui                  | When shared components grow. Move the existing design tokens first                                     |
| Charts       | Recharts                                  | When hand-drawn SVG charts are not enough                                                              |
| Tests        | Vitest, React Testing Library, Playwright | When automatic browser regression is needed. Do not tear out the existing `node:test` without a reason |
| API contract | OpenAPI                                   | When external clients appear                                                                           |
| ORM          | Prisma                                    | Only when the user asks to switch to an ORM. Do not split the migration source in two                  |

If you want to use any of these candidates in a new project from the start, adopt them after you get the user's confirmation as rule 1 in chapter 1 says. When you adopt one, keep the run commands, CI, and docs in line in the same PR.

## 4. Repository layout and repository split

### 4.1 Umbrella monorepo + sub-repositories for deploy

- Develop all source in **one umbrella monorepo, `<owner>/<app>`.** Issues, branches, PRs, and reviews all happen there.
- Sync the four per-area repositories with `git subtree split` **only for deploy and sharing.** During everyday PR work, do not push directly to the sub-repositories or to `main`.

| Prefix folder     | Sub-repository (private)            | Contents                                      |
| ----------------- | ----------------------------------- | --------------------------------------------- |
| `frontend/`       | `<owner>/<app>-frontend`            | React app, Dockerfile, nginx.conf, its own CI |
| `backend/`        | `<owner>/<app>-backend`             | Express API, Dockerfile, its own CI           |
| `database/`       | `<owner>/<app>-db`                  | SQL migrations, README                        |
| `infrastructure/` | `<owner>/shared-aws-infrastructure` | Terraform shared by several apps, its own CI  |

- First creation: `scripts/create-repositories.ps1 -Owner <owner>`. It creates 5 repositories, splits each prefix folder into an `export/<part>` branch, and pushes it to the sub-repository's `main`.
- Sync: `scripts/push-repositories.ps1`. Run it **only when the user asks for a sync** (it also pushes the umbrella `main`).
- If you fixed something directly in a sub-repository, first pull it in with `git subtree pull --prefix=<part> <url> main --squash`.
- So that a sub-repository builds on its own, put each one's own `package-lock.json`, `.github/workflows/ci.yml`, `.gitignore`, and `.dockerignore` in `frontend/` and `backend/`.

### 4.2 Directory layout

```text
<app>/
├─ AGENTS.md                 # Shared AI instructions (Codex baseline, Claude reads it too)
├─ CLAUDE.md                 # [Recommended] "Follow AGENTS.md" + Claude-only differences
├─ README.md
├─ package.json              # workspaces, shared scripts, lint and format tools
├─ package-lock.json
├─ .nvmrc / .node-version    # 24.21.0
├─ .npmrc  .editorconfig  .gitattributes  .gitignore
├─ .prettierrc.json  .prettierignore  eslint.config.mjs
├─ .env.example              # Example only, no secrets
├─ compose.yaml
├─ .github/workflows/ci.yml  # Integrated CI
├─ frontend/  backend/  database/  infrastructure/
├─ scripts/                  # Repository creation, sync, backup, and check scripts
├─ skills/<app>-*/SKILL.md   # Source of the AI work procedures
├─ .claude/skills/           # Copy for Claude Code (npm run skills:sync)
└─ docs/  changes/  daily/  next-steps/
```

- `.local/` is for local tools, temporary worktrees, and logs. Exclude it from Git and Prettier.
- When features grow, do not keep every screen in the single `frontend/src/main.tsx`; split it into per-feature modules (`routines.tsx`, `body.tsx`, and so on). In workout-memo `main.tsx` grew large and concurrent PRs conflicted often.

## 5. Core config files

What follows is the real content used in workout-memo. Only the names and ports are replaced with placeholders.

### 5.1 Runtime, editor, and line endings

`.nvmrc`, `.node-version`

```text
24.21.0
```

`.npmrc`: block installs when the engine does not match, and save dependency versions exactly.

```ini
engine-strict=true
save-exact=true
```

`.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

`.gitattributes`: LF in the repository, CRLF only for PowerShell scripts.

```text
* text=auto eol=lf
*.ps1 text eol=crlf
```

### 5.2 Root `package.json`

```json
{
  "name": "<app>",
  "private": true,
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev": "concurrently -k \"npm run dev -w backend\" \"npm run dev -w frontend\"",
    "build": "npm run build -w frontend && npm run build -w backend",
    "test": "npm run test -w backend",
    "test:skills": "node --test scripts/test/claude-skills.test.mjs",
    "skills:sync": "node scripts/claude-skills.mjs sync",
    "skills:check": "node scripts/claude-skills.mjs",
    "check": "npm run format:check && npm run lint && npm run typecheck && npm test && npm run test:skills && npm run build",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "lint": "eslint . --max-warnings 0",
    "typecheck": "npm run typecheck --workspaces"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "concurrently": "^9.2.0",
    "eslint": "10.12.0",
    "eslint-config-prettier": "10.1.8",
    "eslint-plugin-react-hooks": "7.1.1",
    "globals": "16.5.0",
    "prettier": "3.9.10",
    "typescript-eslint": "8.71.2"
  },
  "allowScripts": { "esbuild@0.28.2": true, "esbuild@0.25.12": true },
  "engines": { "node": "24.21.0", "npm": "11.19.0" },
  "packageManager": "npm@11.19.0"
}
```

The single `npm run check` runs format → lint → types → tests → build. **Always run it before committing and before creating or updating a PR.** If you add a local AI worker, add `test:agents` to `check` (see workout-memo).

### 5.3 Format and lint

`.prettierrc.json`

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "endOfLine": "lf"
}
```

`.prettierignore`

```text
node_modules/
**/dist/
.local/
.git/
.env
package-lock.json
**/package-lock.json
infrastructure/.terraform/
**/*.tfstate*
backups/
.bkit/
.playwright-mcp/
```

`.bkit/` and `.playwright-mcp/` are local output made by Claude Code plugins and browser tools. If Prettier checks these folders, `npm run check` fails.

`eslint.config.mjs`

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '.local/**', 'infrastructure/.terraform/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
  prettier,
);
```

Code rules: write React components and types in PascalCase, and variables and functions in camelCase. Prefix an argument that must be declared but is not used (such as in an Express error middleware) with `_`. At error boundaries, take the value as `unknown` and check only the fields you need.

### 5.4 `.gitignore`

```text
node_modules/
dist/
.env
*.log
.terraform/
*.tfstate*
*.tfplan
backups/
.local/
.bkit/
.playwright-mcp/
```

### 5.5 TypeScript

`frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

`backend/tsconfig.json` (build) and `backend/tsconfig.check.json` (type check including tests)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

```json
{ "extends": "./tsconfig.json", "compilerOptions": { "noEmit": true }, "include": ["src", "test"] }
```

### 5.6 Workspace `package.json` scripts

- frontend: `"dev": "vite --host 127.0.0.1"`, `"build": "tsc --noEmit && vite build"`, `"typecheck": "tsc --noEmit"`
- backend: `"dev": "tsx watch --env-file-if-exists=../.env src/server.ts"`, `"start": "node dist/server.js"`, `"build": "tsc"`, `"test": "tsx --test test/*.test.ts"`, `"typecheck": "tsc -p tsconfig.check.json"`
- Both workspaces have `engines`, `packageManager`, and `"allowScripts": { "esbuild": true }`.

`frontend/vite.config.ts`

```ts
import { defineConfig } from 'vite';
export default defineConfig({ server: { proxy: { '/api': 'http://127.0.0.1:<api-port>' } } });
```

### 5.7 Docker Compose and images

`compose.yaml`: bind every port to `127.0.0.1` only (this protects an app without login).

```yaml
services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-<db>}
      POSTGRES_USER: ${POSTGRES_USER:-<db>}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Copy .env.example to .env and set password}
      TZ: <timezone>
    ports: ['127.0.0.1:<db-port>:5432']
    volumes:
      - <app>-data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
      interval: 5s
      timeout: 5s
      retries: 15
    restart: unless-stopped
  api:
    build: ./backend
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER:-<db>}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB:-<db>}
      PORT: <api-port>
      TZ: <timezone>
    depends_on:
      db: { condition: service_healthy }
    restart: unless-stopped
  web:
    build: ./frontend
    ports: ['127.0.0.1:<web-port>:80']
    depends_on: [api]
    restart: unless-stopped
volumes:
  <app>-data:
```

`.env.example`

```ini
POSTGRES_DB=<db>
POSTGRES_USER=<db>
POSTGRES_PASSWORD=change-this-local-password
DATABASE_URL=postgres://<db>:change-this-local-password@localhost:<db-port>/<db>
PORT=<api-port>
```

`backend/Dockerfile`: split build and run, and run the run stage as the non-root (`node`) user.

```dockerfile
FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --global npm@11.19.0
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
FROM node:24.21.0-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE <api-port>
CMD ["node", "dist/server.js"]
```

`frontend/Dockerfile` + `frontend/nginx.conf`

```dockerfile
FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --global npm@11.19.0
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  location /api/ { proxy_pass http://api:<api-port>; proxy_set_header Host $host; }
  location / { try_files $uri $uri/ /index.html; }
  add_header X-Content-Type-Options nosniff always;
  add_header Referrer-Policy same-origin always;
}
```

## 6. Backend and DB implementation rules

### 6.1 API structure

- `createApp(pool)` builds and returns the Express app, and `server.ts` only calls `listen`. That lets tests start the app with a real DB pool or a fake pool. To fix "today" in tests, add an injection point such as `createApp(pool, { today })`.
- `app.disable('x-powered-by')`, `express.json({ limit: '256kb' })`. Raise the limit separately only on the route for large uploads (for example restoring a backup).
- Validate every input with Zod before touching the DB. A shared error middleware turns `ZodError` into 400 and a unique constraint violation (23505) into 409, and returns Korean messages.
- Check health with `GET /api/health`.
- Receive pg's `date` type (OID 1082) as a string: `types.setTypeParser(1082, (v) => v)`. This stops it from turning into a JS `Date` and shifting by time zone.
- Wrap a change that writes several rows (a log plus its sets, and so on) in `BEGIN … COMMIT` on one client, `ROLLBACK` on error, and `release()` in `finally`.
- Every query uses parameters (`$1`). If you must build a table or column name as a string, use constants only.

### 6.2 Save safety patterns (apply to the apps that need them)

- **Idempotent retry:** the client attaches a UUID `Idempotency-Key` to POST/PUT.
  - The server serializes the same key inside a transaction with `pg_advisory_xact_lock(hashtextextended(key))`.
  - It stores the request fingerprint (method, target, and the SHA-256 of the normalized body) and the response, and returns the same response for the same request.
  - If the same key is used with different content, reject it with 409.
- **Concurrent edit conflict:** keep a `version` on the row, run `SELECT … FOR UPDATE`, and compare versions. If they differ, return 409; if they match, update with `version+1`.
- **Browser draft:** keep what is being typed in `localStorage` (for example for 7 days) and show the save state. Wrap every storage access in `try/catch` (private mode, quota exceeded).

### 6.3 DB and migrations

- PostgreSQL 17. Keep the migration source in **one place** only, `database/migrations/NNN_<description>.sql`.
- Number them with a 3-digit sequence. **Reserve the number when work starts so parallel branches do not use the same number.** In workout-memo, PRs opened at the same time have used `003` twice.
- Write every migration so it is safe to run again: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, and seed data with `INSERT … ON CONFLICT DO NOTHING/UPDATE`.
- Preserve the meaning of existing data. For example, give a new `completed` column the default `true` so the judgment of past records does not change.
- How migrations are applied:
  - Empty volume: Compose runs every file in `/docker-entrypoint-initdb.d` automatically in name order.
  - CI: apply every file in name order with `psql -v ON_ERROR_STOP=1 -f`.
  - **Existing DB: run the file mounted in the container directly.**

    ```powershell
    docker compose exec -T db psql -U <db> -d <db> -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/NNN_<description>.sql
    ```

    **Do not pipe it through PowerShell**, as in `Get-Content … | docker compose exec … psql`. Windows PowerShell 5.1 sends ASCII when it pipes to an external program, so Korean text turns into `?`. In workout-memo this was reproduced as the brand `'기타'` ("Other") being stored twice as `'??'`. If you have no choice but to pipe, first set `$OutputEncoding = [System.Text.UTF8Encoding]::new($false)`.
- For Korean literals in SQL (CHECK values and so on), use Unicode escapes such as `U&'\AC00\C2B4'` when possible. They are safe whatever the apply path.
- State the unit and NULL rules in the schema. Leave a value you could not confirm as NULL and keep it apart from 0. Set numeric precision with `NUMERIC(p,s)`.
- Backup: `scripts/backup.ps1` saves `pg_dump --no-owner --no-acl` to a UTF-8 file (no BOM). Exclude `backups/` from Git, also keep a copy in a safe place outside the PC, and check restores regularly.

## 7. Tests and CI

### 7.1 Test principles

- Put tests in the same commit as the implementation or fix. For a bug fix, add a regression test where you confirmed **fail before the fix → pass after the fix**.
- Do not repeat the internal implementation; verify the results the user can see and the domain rules.
- Do not make a failing test pass by skipping or deleting it or by weakening its checks.

### 7.2 Test kinds [Applied now]

| Kind           | Tool and method                                                                                                                                        | Example file                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------- |
| Unit           | `node:test` + `assert/strict`, `tsx --test`                                                                                                            | `backend/test/*.test.ts`          |
| DB integration | A real PostgreSQL. **Skipped** when `TEST_DATABASE_URL` is not set. Skipped tests do not count as passed                                               | `*.integration.test.ts`           |
| UI             | Load the component with `vm.runInNewContext` + `ts.transpileModule`, and check the render result with a fake React, `fetch`, `localStorage`, and clock | `*-ui.test.ts`                    |
| Browser        | A real dev server + Playwright (MCP) at mobile 390px and PC 1440px. This is a manual check before the PR, not a replacement for automatic regression   | Record the result in docs/changes |

- Run DB integration tests **only on a dedicated test DB, not the user's DB.** To keep parallel work from interfering, use a DB per branch (issue) or a schema per test.
- For tests that depend on dates, inject "today" or fix it with a fake `Date`.

### 7.3 Integrated CI (`.github/workflows/ci.yml`)

```yaml
name: Verify application
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17-alpine
        env: { POSTGRES_USER: <db>, POSTGRES_PASSWORD: test, POSTGRES_DB: <db> }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24.21.0', cache: npm }
      - run: npm install --global npm@11.19.0
      - run: npm ci
      - run: |
          for migration in database/migrations/*.sql; do
            psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration" || exit 1
          done
        env: { TEST_DATABASE_URL: 'postgres://<db>:test@localhost:5432/<db>' }
      - run: npm run check
        env: { TEST_DATABASE_URL: 'postgres://<db>:test@localhost:5432/<db>' }

  docker-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t <app>-frontend:ci ./frontend
      - run: docker build -t <app>-backend:ci ./backend
```

`npm ci` inside a CI runner installs from the lockfile in an isolated GitHub environment, so it is separate from the rule against local installs. The CI for the sub-repositories is as follows.

- `frontend/.github/workflows/ci.yml`: `npm ci` → `npm run build` → `docker build`
- `backend/.github/workflows/ci.yml`: `npm ci` → `npm run build` → `npm test` (unit tests without a DB; integration tests are skipped) → `docker build`
- `infrastructure/.github/workflows/ci.yml`: `terraform init -backend=false && terraform validate`

## 8. Design system

workout-memo has a calm green "workout notebook" tone. Unless told otherwise, a new project also starts from the tokens and components below. In a new project, **define the values as CSS variables (`:root`) from the start.** workout-memo wrote colors directly, which made it hard to share them later.

### 8.1 Tokens

| Token                 | Value                                                           | Use                                        |
| --------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Font                  | `'DM Sans', 'Noto Sans KR', sans-serif` (Google Fonts)          | DM Sans for Latin, Noto Sans KR for Korean |
| Base font size        | `14px`, `font-synthesis: none`                                  |                                            |
| Body color            | `#25372f`                                                       | Text                                       |
| Page background       | `#f7f8f5`                                                       |                                            |
| Sidebar background    | `#fcfcfa`, divider `#e5e8e1`                                    |                                            |
| Primary color         | `#294432` background / `#f3f7ec` text                           | Primary button                             |
| Accent (focus)        | `#a1bd56`                                                       | `:focus-visible` 3px outline, 3px offset   |
| Card                  | Background `#fff`, border `#e3e7dd`, radius `9px`               |                                            |
| Modal                 | Background `#fcfdf9`, radius `12px`, shadow `0 20px 80px #0003` |                                            |
| Secondary background  | `#f4f6ef`, `#eaf0df`                                            | Tabs and notice boxes                      |
| Muted text            | `#9aa48f`                                                       | Secondary description                      |
| Warning background    | `#fff0e9`                                                       | Errors                                     |
| Button radius         | `6px`, padding `12px 17px`, text `12px/500`                     |                                            |
| Theme color (browser) | `<meta name="theme-color" content="#182b26">`                   |                                            |

### 8.2 Layout and components

- **Shell:** a fixed left sidebar (`aside`, 234px wide, with logo, navigation, and profile) and the content on the right. Put a breadcrumb at the top ("My workspace › Screen").
- **Page header:** a small uppercase line (eyebrow) + a large title + a description + a primary button on the right.
- **Period bar:** tabs (1 day, 1 week, 1 month, 4 weeks, 12 weeks) + previous/next + a date input.
- **Stat card:** a label, a large number + unit, and a secondary description below.
- **Card and list row:** a date tile, a title, a summary, and value, edit, and delete on the right.
- **Three button kinds:** `primary` (main action), `subtle-button` (secondary), `text-button` (weak action). Use lucide-react for icons, and always give an icon-only button an `aria-label`.
- **Modal form:** a 2-column `form-grid`, with the label wrapping the input (`<label>text<input/></label>`). Input guidance uses `form-hint`.
- **State display:** `role="status"` for save state, `role="alert"` for errors, `aria-pressed` for toggles, and an empty-state notice (title + description + action button) when there is nothing to show.
- **Charts:** draw them by hand with SVG and CSS, no library, and add `role="img"` and an `aria-label` that summarizes the values. Do not connect days with no value as if they were 0.

### 8.3 Responsive and verification

- Breakpoints: `min-width: 1500px` (wide screens), `max-width: 1100px` (tablet), `max-width: 760px` (mobile).
- A PR that changes a screen is checked in a real browser at **mobile 390×844 and PC 1440×900.** Check that there is no horizontal scroll (`scrollWidth > innerWidth`) and record the result in docs/changes.
- Fix problems found in the browser check (a double-click toggle, a screen that does not refresh after saving, and so on) together with a regression test.

## 9. Git strategy

- **GitHub Flow:** keep `main` always deployable. Every change starts from an issue.
- **Order:** register a GitHub issue → a branch named with the issue number → implementation, tests, and the `docs/changes` record in the same commit → `npm run check` → PR → **automatic code review (at most 2 rounds)** → check CI → **agent merge (merge commit) after the required CI passes**.
- **Issue:** write the purpose, scope, completion criteria (checkboxes), verification method, and boundaries. Leave rules that must be settled as "decisions before implementation", and when the user settles them, record the confirmed rule as an issue comment. Write the body as a UTF-8 file and register it with `gh issue create --body-file`.
- **Branch:** `<type>/<issue-number>-<slug>`. The type is `feat`, `fix`, `docs`, or `chore` (for example `feat/12-workout-editor`). If a branch for the same issue already exists, keep using it.
- **Commit title:** `feat: <English summary> (#12)`. Write the reason in the body. For AI co-authoring, add a `Co-Authored-By:` line.
- **PR:** the target is `main`. Put the following in the body.
  - A summary, the main changes, and the actual check commands with pass/fail/skip
  - The check results for screen changes, and the judgments and items that need confirmation
  - `Closes #N` (`Refs #N` for a partial implementation)

  If verification remains, keep it as a draft. If a PR for the same branch exists, update it instead of creating a new one.

- **Review:** after you open the PR, it goes through a read-only automatic code review, separate from the authoring context, at most 2 times. Apply findings in additional commits and get a second review after the first round of fixes; do not review further after the second round of fix commits. If there are no findings, go straight to CI. Split fixes too large for this PR (a feature outside the requested scope, a design or data structure change, a change across several modules, or work that needs separate verification) into a new issue card. If a new commit appears during review, do not merge on the earlier CI result.
- **Merge:** once all required CI checks on the final head pass, the agent merges with a merge commit (`pr merge <url> --merge --match-head-commit <the head SHA you checked>`) and confirms that the linked issue is closed. When several PRs change the same file, or the PRs are consecutive, merge them in order. After the earlier PR merges, merge `origin/main` into the later PR and resolve conflicts, confirm with tests that both features survive, push normally (no force), and merge after CI passes.
- **Parallel work:** use a separate `git worktree` for each issue. Avoid a shared stash, and separate the migration number and the test DB per issue.

## 10. AI instruction system

### 10.1 File roles

| File                                                       | Role                                                                                                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                | Shared instructions for all agents. Work procedure, project baseline (ports, time zone, units), verification commands, prohibitions, account rules |
| `CLAUDE.md` [Recommended]                                  | The file Claude Code reads automatically. Write only "This project follows `AGENTS.md`" + the Claude-only differences, briefly                     |
| `skills/<app>-implementation/SKILL.md`                     | The procedure: issue → branch → implementation and docs → tests → PR → automatic review (at most 2 rounds) → agent merge after CI passes           |
| `skills/<app>-testing/SKILL.md`                            | Standards for writing, running, and recording tests                                                                                                |
| `skills/<app>-foundation/SKILL.md` + `references/stack.md` | Development foundation, technology recommendations, and the order to apply them                                                                    |
| `.claude/skills/`                                          | The Claude Code copy of `skills/`. Edit only the source and refresh with `npm run skills:sync`; `npm run check` fails on a mismatch                |

- The single source of the skills is the repository's `skills/`. Codex installs them in the `skills/` of the Codex home, and Claude Code reads `.claude/skills/`.
- Skill files have YAML front matter (`name`, `description`). After a change, validate with skill-creator's `quick_validate.py` (`PYTHONUTF8=1` on Windows).
- Do not use repository-relative links in a skill body. This keeps the links from breaking when the copy lives somewhere else.

### 10.2 What to put in `AGENTS.md` (template)

```markdown
# <App display name> project instructions

## Implementation procedure

For requests to change features, fixes, refactoring, settings, docs, or skills, follow skills/<app>-implementation/SKILL.md.

1. Register an issue in <owner>/<app> (reuse an existing issue the user named).
2. Create a `<type>/<issue-number>-<slug>` branch.
3. Write the implementation and tests together, and include a docs/changes/<issue-number>-<slug>.md record in each commit.
4. Run `npm run check` before committing and before creating or updating a PR, and record the result in the docs and the PR.
5. **After you open a PR, it goes through automatic code review at most 2 times. Apply review findings in additional commits, and get a second review after the first round of fixes. Do not review further after the second round of fix commits. If there are no findings, go straight to the next step. Split any fix too large for this PR into a new issue card. After that, once all required CI checks on the final head pass, the agent merges with a merge commit without asking the user and confirms that the linked issue is closed.** Do not merge with a failing or running check, bypass with `--admin`, approve your own PR, push directly to `main`, or force push.
   Answering questions, giving recommendations, and read-only investigation do not create an issue or a branch.

## Project baseline

- Tech: React + Vite + TypeScript, Express + pg + Zod, PostgreSQL 17, npm workspaces, Docker Compose, GitHub Actions.
- Web port <web-port>, host DB port <db-port> (bound to 127.0.0.1). Do not change them without a user request.
- Dates YYYY-MM-DD, time zone <timezone>. <Domain unit and NULL rules>.
- Validate and judge input on the server too. Use a transaction for multi-row changes.
- Do not commit or record .env, tokens, real backups, or Terraform state.
- Do not overwrite user changes, and stage only the files you need.
- Install or remove npm packages only after the user reconfirms, with --ignore-scripts first.
- Syncing the sub-repositories (scripts/push-repositories.ps1) and AWS deploys happen only on a separate request.

## Verification commands

- Full: `npm run check`. DB integration: set `TEST_DATABASE_URL` for a dedicated DB and run `npm test` (skipped when unset = unverified).
- Infrastructure: `terraform validate`. Docs and skills only: format, link, and skill validators.

## Docs

- docs/changes (per issue), docs/daily (summary of a working day), docs/next-steps (the latest next steps).
```

### 10.3 Account separation (a PC that uses work and personal accounts together)

- Leave the default `gh` as it is and use a project-specific wrapper (`scripts/gh-project.ps1`). The wrapper clears an inherited `GH_TOKEN`/`GITHUB_TOKEN` and applies the token received from `gh auth token --user <owner>` to that call only.
- Set the wrapper as the **local** credential helper of this repository for Git push. Do not change the global helper.
- Before any remote work, check that `<wrapper> api user --jq .login` is `<owner>`. Do not work around it with another account.
- Run the wrapper inside a git repository. It fails when run outside one.
- Pick the Codex personal profile with the `CODEX_HOME` environment variable. For the implementation details, see workout-memo's `docs/project-github-auth.md`.

### 10.4 [Optional] Local AI worker

workout-memo runs a worker (`scripts/agents.ps1`) that, once a confirmed issue is put in a queue, handles tests → implementation → independent review → checks → PR automatically on the PC. A new project does not need it from the start. When you adopt one, keep these points.

- Fix the model for each role (for example a higher-tier model for planning, debugging, and high-risk review, and a standard model for tests, implementation, and review). Do not switch to another model on your own.
- Test the per-issue worktree, the lock, and the state transitions (`npm run test:agents`).
- **Inside a sandbox, the Vite/esbuild build can fail because of a permission problem reading the parent folder.** Run the final `npm run check` on the host.
- Details: workout-memo's `docs/local-agent-workflow.md`.

## 11. Bootstrap checklist

Each step must pass its "Check" before you go to the next.

1. **Settle the values:** get the placeholders in chapter 0 from the user. Check: the table is filled in.
2. **Account and remote:** confirm the GitHub account to use and, if needed, prepare the wrapper from 10.3. Check: `api user --jq .login` = `<owner>`.
3. **Runtime:** pick Node 24.21.0 / npm 11.19.0 (with a user tool such as nvm or Volta; do not change the system Node on your own). Check: `node -v`, `npm -v`.
4. **Skeleton files:** create the 4.2 layout, the config files in chapter 5, `.env.example`, `compose.yaml`, the Dockerfiles, nginx.conf, and `database/migrations/001_initial.sql` (a minimal table).
5. **Install dependencies (user confirmation required):** show the package list in 3.1, get approval through the procedure in rule 1 of chapter 1, and then install. Check: `package-lock.json` and each workspace lockfile exist.
6. **Minimal feature:** build `createApp(pool)`, `GET /api/health`, one baseline screen, one unit test, one DB integration test, and one UI test.
7. **Local verification:**
   - Start the DB with `docker compose up -d db`.
   - Create a dedicated test DB and apply every migration with `psql -f`.
   - Set `TEST_DATABASE_URL` and run `npm run check`.

   Check: exit code 0 and the DB tests were not skipped.

8. **Run the containers:** create `.env` and run `docker compose up --build -d`. Check: the page at `http://localhost:<web-port>` and the `/api/health` response are healthy.
9. **AI instructions:** create the chapter 10 `AGENTS.md`, `CLAUDE.md`, the three skills, and the `.claude/skills` sync script and its test. Check: `npm run check` includes `test:skills` and passes.
10. **Docs:** create the README (run, verification, repository layout), `docs/development-baseline.md`, `docs/changes/`, `docs/daily/`, and `docs/next-steps/`.
11. **Create the repositories:** after user approval, create the umbrella repository and the 4 sub-repositories as private with `scripts/create-repositories.ps1 -Owner <owner>`. Check: the CI of each repository passes.
12. **Infrastructure draft:** put the chapter 12 Terraform in `infrastructure/` and run `terraform init -backend=false && terraform validate`. Run a real `apply` only when the user asks for a deploy.
13. **GitHub Flow from the first issue:** from then on, do every change by the chapter 9 procedure.

## 12. AWS infrastructure

### 12.1 [Applied now] Shared Terraform draft (`infrastructure/`)

- Several apps share the region `<region>` (default `ap-northeast-2`) and the `project` variable (default `shared-apps`).
- **ECR:** a frontend and a backend repository per app (`for_each`), immutable tags (IMMUTABLE), image scanning on push, AES256 encryption, and a lifecycle policy that keeps only the latest 10 images.
- **AWS Budgets:** `<budget-usd>` USD per month, with an email when actual spend passes 80%. A budget alert **does not stop spending.**
- Run: `terraform init` → `terraform plan -var='budget_email=…'` → `terraform apply …`. **Do not put the state file in Git** (it can hold sensitive data).
- To add another app, add its name to the ECR `for_each` list.

```hcl
terraform {
  required_version = ">= 1.6.0"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
}
provider "aws" { region = var.region }
```

### 12.2 Deploy alternatives (not connected yet; costs estimated from the official Seoul-region prices of 2026-10-15)

| Alternative                              | Setup                                                                 | Monthly cost estimate (before tax)                                        | Notes                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Shared server (several personal apps) | One Lightsail server with Docker Compose + PostgreSQL, ECR, snapshots | 2 GB: about $13.50 / 4 GB: about $25.50 (whole server)                    | 0.5-1 GB leaves too little room. Separate the DB or schema and permissions per app |
| 2. App server + managed DB               | EC2/Lightsail + RDS PostgreSQL                                        | The user's initial budget of 30,000-60,000 KRW or more (not a firm quote) | Less backup and maintenance work                                                   |
| 3. Managed scale-out                     | ECS Fargate + ECR + RDS + ALB                                         | High fixed cost                                                           | When traffic and availability are needed                                           |
| Static frontend only                     | Amplify and so on                                                     | Calculated separately                                                     | The API and DB are needed separately                                               |

- **Do not expose an app without login directly to the public internet.** Design a VPN, private access, or authentication first.
- Prepare these together when you deploy: HTTPS, remote state (S3 + locking), a GitHub OIDC deploy role (no long-lived keys), image version tags, health checks, the CloudWatch log retention period, the backup and restore procedure, and a way to roll back to the previous image.
- Detailed cost calculation: workout-memo's `docs/shared-hosting-costs.md`.

## 13. Pitfalls confirmed in this project

| Symptom                                                                    | Cause                                                              | Response                                                                                            |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Korean is stored as `?` in the DB and rows are duplicated when re-applied  | The PowerShell 5.1 pipe sends ASCII                                | Run the mounted file with `psql -f`, or set `$OutputEncoding` to UTF-8, and use `U&` escapes in SQL |
| Only the build in `npm run check` fails in an AI sandbox                   | Vite/esbuild cannot read the parent folder (shared `node_modules`) | Run the final check on the host and record the result                                               |
| The Prettier check suddenly fails                                          | Tool output such as `.bkit/` and `.playwright-mcp/`                | Add them to `.gitignore` and `.prettierignore`                                                      |
| Parallel PRs use the same migration number                                 | Each branch picks the next number on its own                       | Reserve the number when work starts                                                                 |
| Several PRs keep conflicting in the same large file (`main.tsx`, `app.ts`) | Screens and routes are gathered in one file                        | Split into per-feature modules, merge `main` in the later PR, and confirm both features with tests  |
| Double-clicking a toggle button reverses the state                         | The two clicks are handled in different renders                    | Ignore the opposite action within a short time + a regression test                                  |
| Data saved on another screen does not show when you come back              | The screen does not reload on entry                                | Re-fetch on screen change                                                                           |
| A server validation error shows in the original English                    | Zod's default message                                              | Give Korean messages to the validation the user can see                                             |
| After a backup "full replace", a retry answers a deleted id as "saved"     | The idempotency retry key is still there                           | When restoring by replacement, also reset the retry keys in the same transaction                    |
| A DB test looked "passed" but was not actually run                         | It is skipped when `TEST_DATABASE_URL` is not set                  | Check the skip count and report what was not run separately                                         |

## 14. Source files to refer to (workout-memo)

When you take the settings over as they are, compare against the files below as the source.

- Instructions: `AGENTS.md`, `skills/workout-implementation/SKILL.md`, `skills/workout-testing/SKILL.md`, `skills/workout-foundation/SKILL.md`, `skills/workout-foundation/references/stack.md`
- Settings: `package.json`, `.npmrc`, `.editorconfig`, `.gitattributes`, `.prettierrc.json`, `.prettierignore`, `eslint.config.mjs`, `frontend/tsconfig.json`, `backend/tsconfig*.json`, `frontend/vite.config.ts`
- Running: `compose.yaml`, `.env.example`, `frontend/Dockerfile`, `frontend/nginx.conf`, `backend/Dockerfile`
- CI: `.github/workflows/ci.yml`, `frontend|backend|infrastructure/.github/workflows/ci.yml`
- Repositories: `scripts/create-repositories.ps1`, `scripts/push-repositories.ps1`, `scripts/backup.ps1`, `scripts/claude-skills.mjs`
- Infrastructure: `infrastructure/main.tf`, `infrastructure/versions.tf`, `infrastructure/README.md`
- Docs: `docs/development-baseline.md`, `docs/project-github-auth.md`, `docs/local-agent-workflow.md`, `docs/shared-hosting-costs.md`, `docs/agent-issue-template.md`
