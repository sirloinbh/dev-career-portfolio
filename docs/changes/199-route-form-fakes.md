# Route the remaining form test fakes by method and path (#199)

- The fakes in `career-form`, `certification-form`, `skill-form`, `application-form` and `cover-letter-form` tests now read requests with `parseRequest` (`frontend/src/test/route.ts`, from #148) and answer only the endpoints their screen uses. Anything else throws `Unexpected request in the test fake: METHOD /path`.
- Ids come from the parsed path instead of `url.split('/')[3]`. The application fake also answers `GET /api/applications/<id>/questions` (the delete dialog count), and the cover-letter fake keeps its "application 9 does not exist" 404.
- Test-only change; fixture ids stay numeric.
- Verification: the five test files, then `npm run check`.
