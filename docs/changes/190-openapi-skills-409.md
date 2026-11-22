# List every status code the skills routes answer in the OpenAPI document (#190)

- `POST /api/skills` and `PUT /api/skills/:id` now list 409 (the name is taken, `refuseDuplicateName`); `docs/openapi.json` is regenerated.
- `backend/test/openapi.test.ts`: a status that a route file throws as `HttpError(<status>` must be listed by an operation under that route's path, and the two skills operations list 409. The test fails if the 409 is removed from the table.
