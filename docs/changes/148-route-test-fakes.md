# Route screen test fakes by method and path (#148)

- New `frontend/src/test/route.ts` (`parseRequest`, `unexpectedRequest`) with `route.test.ts`: a fake reads the method and `new URL(...).pathname`, and a request it does not know throws `Unexpected request in the test fake: <METHOD> <path>`.
- `applications.test.tsx`, `education-form.test.tsx` and `project-form.test.tsx` fakes now answer only the endpoints the screen really uses; ids come from the parsed path, not `url.split('/')[3]`. Fixture ids stay numeric (#141).
- Pure helper tests (`projectFieldErrors`, `splitTechnologies`, `toProjectForm`, `toProjectInput`) moved from `project-form.test.tsx` to the new `project-data.test.ts`.
- Test-only change. Other form-test fakes (career, certification, skill, application, cover letter) are left as they are to avoid conflicts with the form work in #143; they can adopt `test/route.ts` later.
- Verification: `npm run check`.
