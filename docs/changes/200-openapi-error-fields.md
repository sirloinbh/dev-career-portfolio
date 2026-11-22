# Describe the validation fields list in the OpenAPI Error schema (#200)

- `backend/src/openapi.ts` adds an optional `fields: [{ path, message }]` to the shared `Error` schema (`path` is the dotted path string the handler sends) and mentions it in the API description; `docs/openapi.json` is regenerated. The managed `standard/openapi.ts` builder has no option for it, so the built document is extended in the app file and the managed file is untouched.
- The error-handler line in `app.ts` is unchanged.
- Test (`backend/test/openapi.test.ts`): `error` stays required and `fields` lists `path` and `message`.
