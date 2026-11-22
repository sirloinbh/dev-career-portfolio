# #214 Use the shared errorFields option for the OpenAPI Error schema

- Issue: [#214](https://github.com/sirloinbh/dev-career-portfolio/issues/214)
- Branch: `chore/214-shared-error-fields`
- Related: #200 (the hand patch), sirloinbh/project-standards#999 (the option), sync PR #212

## Changes — 2026-11-22

`backend/src/openapi.ts` passes `errorFields: true` to the shared `buildOpenApi` and no longer mutates `document.components.schemas.Error` after building it. The `fields` array keeps the same shape (items `{ path, message }`, both required; `error` stays the only required property). Regenerated `docs/openapi.json`: only two descriptions change to the shared wording (`path`: "Where the field is in the input, joined by dots (items.0.name)"; `message`: "The message for this field").

## Verification

- `npm run openapi`: `docs/openapi.json: 16 paths`; the diff is the two descriptions above.
- `npm test -w backend`: 102 passed, including "the Error schema keeps error required and lists the validation fields (#200)".
- `npm run check`: passed (frontend 412 passed, 3 skipped; DB integration tests skip locally and run in CI).
