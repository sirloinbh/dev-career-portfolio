# Create, edit, and delete applications on screen (#49)

Issue: [#49](https://github.com/sirloinbh/dev-career-portfolio/issues/49) (parent issue #68, applications and cover letters)

Note: test and fixture data are made-up Korean company names, quoted as they appear on screen.

## Purpose

The #48 list under the "Cover letters" menu only showed applications. This change adds create, edit, and delete on screen with the #36 API, in the same structure as the other item screens (#39 form structure, #47 certifications).

## Changes

- `frontend/src/application-data.ts`: the form type `ApplicationForm`, `emptyApplicationForm` (status starts as drafting), `toApplicationForm`, `toApplicationInput` (a blank deadline goes as `null`), the field mapping for server messages `applicationFieldErrors`, the status list `applicationStatuses`, `ApplicationPaths`, and `applicationApi.create`, `update`, and `remove`.
- `frontend/src/applications.tsx`:
  - The list gets an "Add application" button, and each row gets "Edit" and "Delete" buttons. It now uses `useReloading`, so the rows stay on screen while the list reloads after a delete.
  - `NewApplication` (`/applications/new`) and `EditApplication` (`/applications/:id/edit`) share `ApplicationFields`.
  - The delete confirmation dialog says the cover letter questions are deleted too.
- `frontend/src/app.tsx`: the two routes and `applicationPaths`.
- `frontend/src/application-form.test.tsx`: 16 new tests.
  - Create, edit, and a clearing edit.
  - Server messages under their fields, joined messages, and a message that names no field.
  - A half-typed deadline, an application that no longer exists, delete (confirm, cancel, failure), and keyboard-only input.
  - The field mapping and the form conversion helpers.
- `frontend/src/applications.test.tsx`: two list tests checked that a row has no link at all. Each row now has an Edit link, so they check for no job posting link instead.

## Decisions

- **Fields, in screen order:** company name, position, job posting link, deadline, status, notes. These are the #36 columns.
- **Status starts as "Drafting".** A cover letter is usually written before the application is sent. The status is a native `select` with the three values, like the employment type in the career form.
- **An empty deadline is saved as "no deadline"** (`null`), as #36 stores it. A hint under the field says so. A half-typed date is sent as text the server refuses, the same as the other forms, so it is never saved as "no deadline" by mistake.
- **Validation messages come from the server.** The issue says "Korean validation messages", but the API answers in English since #86. The messages are shown under the field they start with ("Application status" maps to the Status field).
- **Delete warns about the cover letter questions.** `cover_letter_questions.application_id` is `ON DELETE CASCADE` (#37), so deleting an application also deletes its questions. The dialog says so.
- **No single-item API:** like the other edit screens, the edit screen finds its row in the list.

## Verification

- `npm run check`: passed (exit code 0). `TEST_DATABASE_URL` pointed at `career_test` on a throwaway Docker PostgreSQL 17 with `database/migrations` applied.
  - Backend: 89 passed and 0 skipped.
  - Frontend: 230 passed and 2 skipped (the existing theme-conditional tests). It includes the 16 new form tests.
  - The skill check (4) and the build also passed.
- `npm run knip`: passed.
- **Real browser:**
  - I drove the installed Chrome (headless 157, `ko-KR`) through the DevTools protocol.
  - The dev servers (API 3108 started with `tsx src/server.ts`, Vite 5208) pointed at the same `career_test`. The API ran without the shared sign-in, as on any local address (#106).
  - The data was 2 made-up applications ("구름데이터" drafting, "바다물류" submitted), and the check day was 2026-11-17.
  - Input was key events only: typed text, Tab between fields, digits and the right arrow in the date field, the down arrow in the status list, and Enter on the submit button.
  - "After a reload" means the list the server returned when the list page was opened again.
  - The pictures are full-page captures. A sticky header or a dialog's dimmed backdrop sits where the viewport was when the picture was taken, so it can look out of place in a tall picture.

| What I checked                                                                                         | Result                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The empty create form (390×844 light)                                                                  | No horizontal overflow, smallest text 14px. Status starts as "Drafting" ([picture](49-application-form/form-new-390-light.png))                                                                                                                                                                                                                                              |
| From the back link, Tab through every field, type a link without `https://`, Tab to "Add", press Enter | Focus went company name → position → job posting link → deadline (Tab also steps through the date's parts) → status → notes → Add. The server message "Job posting link must start with http:// or https://" shows under the link field, focus moves there, and the page stays on the form. No horizontal overflow ([picture](49-application-form/form-error-390-light.png)) |
| Select the link text, type a full address, press Enter                                                 | It returned to the list. After a reload "한빛소프트" (Hanbit Soft) shows as drafting, "Due November 30, 2026 · D-13", with its notes and job posting link ([picture](49-application-form/list-390-light.png))                                                                                                                                                                |
| The edit screen (1440×900 dark)                                                                        | The stored values are filled in ([picture](49-application-form/form-edit-1440-dark.png))                                                                                                                                                                                                                                                                                     |
| Down arrow in Status (Drafting → Submitted), Tab to "Save", Enter                                      | After a reload it shows "Submitted" and the date alone, and it moved after "바다물류" by deadline ([picture](49-application-form/list-1440-dark.png))                                                                                                                                                                                                                        |
| The delete confirmation dialog (390×844 light)                                                         | The title, the company name, and the warning about cover letter questions show ([picture](49-application-form/delete-dialog-390-light.png))                                                                                                                                                                                                                                  |
| Esc in the dialog                                                                                      | It is still in the list after a reload                                                                                                                                                                                                                                                                                                                                       |
| Delete in the dialog                                                                                   | It is gone after a reload, and only the 2 starting applications remain                                                                                                                                                                                                                                                                                                       |

## Limits

- The cover letter questions themselves are #50 and #51.
