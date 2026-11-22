# OutLink checks its own URL (#142)

- `OutLink` runs `webLink(href)` and renders nothing when the URL is not http(s), so a new caller cannot put a `javascript:` link in the page by forgetting the check.
- `webLink` now returns `null` (not `''`) for an empty string.
- Tests: new `out-link.test.tsx` (https link attributes; `javascript:`, `data:`, `ftp:` and empty URLs render no link) and `web-link.test.ts`.
- Verification: `npm run check` (see the PR for the result).
