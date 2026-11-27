# Resume screen with Markdown and print output (#234, part 1)

A new Resume screen (`/resume`, "Resume" in the main menu) builds a resume from the stored data. This is the first part of #234; "an application remembers which projects it highlights" follows in a second PR (a new table and route file).

- Every section (Career, Projects, Education, Certifications, Skills) lists its items as checkboxes with All / None. Everything starts checked. The preview shows only the checked items, and a section with nothing checked is left out.
- "Download Markdown" saves `resume.md`. "Print or save as PDF" writes an A4 page (18 mm margins) into a new window and opens the browser print dialog, so no package is added. If the browser blocks the window, the screen says so.
- `frontend/src/resume-document.ts` builds one structure from the lists; the preview, the Markdown, and the print page all come from it. Typed text is escaped in the print page. Project entries show the linked career's company and the skill names.
- The screen reuses the five list queries (no new API).

| File                                                         | Change                                          |
| ------------------------------------------------------------ | ----------------------------------------------- |
| `frontend/src/resume-document.ts`, `resume-document.test.ts` | Build, Markdown, print HTML, with unit tests    |
| `frontend/src/resume.tsx`, `resume.test.tsx`                 | Screen, preview, download, print; screen tests  |
| `frontend/src/app.tsx`                                       | `/resume` route and menu entry (own lines only) |

Tests: unit tests of the Markdown for a sample data set and for empty sections; screen tests pick items and see only those in the preview, download, print, and a blocked print window. Browser check at 390x844 and 1440x900, and the print page at A4 width (794x1123), is in the PR.
