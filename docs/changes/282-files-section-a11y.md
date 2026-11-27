# Files section: hint wording and duplicate file control (#282)

Found in the #227 browser check (390x844 and 1440x900, Chrome, mock API).

- The hint said the files are "not part of the form below"; the section is under the form, so it now says "above".
- The file input was only visually hidden (`sr-only`), so screen readers saw a second "Choose a file to attach" button next to "Attach file". It is now `hidden`; the Attach file button opens it.

Browser check of the Files section (certification Edit at 390x844, project Edit at 1440x900): list with a long Korean name wraps and stays inside the card with no horizontal scroll; upload adds the file and shows a toast; a 5.3 MB file is refused in the browser with "File must be at most 5 MB" and no request; delete asks for confirmation and removes the row.

Tests: `attachment-section.test.tsx` (unchanged, still passing).
