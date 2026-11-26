# #247 Pick values instead of typing them in forms

Shared rule: sirloinbh/project-standards#1130 (`docs/ui-components.md`, "Pick a value instead of typing it").

## Free-text inputs reviewed

| Form                                          | Field                                          | Decision                                                           |
| --------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Education                                     | School, Major                                  | Combobox of earlier values (a new value is still accepted)         |
| Education                                     | Degree, Status                                 | Already a select                                                   |
| Education                                     | Enrollment, Graduation date                    | Already a date input                                               |
| Education                                     | GPA, Maximum GPA                               | Open numbers with a pair rule; stay text (see `education-data.ts`) |
| Education, Career, Certification, Application | Notes, duties, achievements                    | Free text (open)                                                   |
| Career                                        | Company, Department, Job title                 | Combobox of earlier values                                         |
| Career                                        | Employment type                                | Already a select                                                   |
| Certification                                 | Issuer                                         | Combobox of earlier values                                         |
| Certification                                 | Certification name, Score or grade             | Free text (names and open values)                                  |
| Project                                       | Organization, Role                             | Combobox of earlier values                                         |
| Project                                       | Project name, Technologies (comma list), links | Free text                                                          |
| Skill                                         | Skill name                                     | Free text (name); Category is a select, level is a radio group     |
| Application                                   | Position                                       | Combobox of earlier values                                         |
| Application                                   | Company name                                   | Free text (a name)                                                 |
| Application                                   | Status                                         | Already a select                                                   |
| Cover letter                                  | Question, Answer, Character limit              | Free text / open number                                            |

## Change

| File                                                                                      | Change                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/list-query.ts`, `list-query.test.ts`                                        | `useKnownValues` / `knownValues`: distinct values already used in a field, most used first, ignoring blanks, spaces and case |
| `frontend/src/text-control.tsx`, `text-control.test.tsx`                                  | `TextControl`: a Combobox when it gets known values, a plain Input otherwise                                                 |
| `educations.tsx`, `careers.tsx`, `certifications.tsx`, `projects.tsx`, `applications.tsx` | The fields marked above use `TextControl` with the values from the same list                                                 |
