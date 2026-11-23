# Join the split AI_TOOLS_PUBLIC_KEY comment in .env.example

- Issue: [sirloinbh/project-standards#969](https://github.com/sirloinbh/project-standards/issues/969)
- Branch: `fix/969-env-example-comment`
- Date: 2026-11-23 (Asia/Seoul)

## Problem

`.env.example` line 6 ended mid-sentence and line 7 started with ` escapes). Set: ...`: a real line break where the text means the two characters `\n`. A `.env` copied from it made `docker compose` fail with `line 7: unexpected character ")" in variable name`.

## Change

- `.env.example`: lines 6–7 are one comment again (`one line with \n escapes`).

## Checks

- `cp .env.example .env && docker compose config --services` lists db, api, web (it failed before).
- The new bare-line rule from project-standards#1019 finds no bare line in this file.
