# Add a retry and a reliable announcement to the list load error (#187)

- `ItemListPage` now renders one `LoadErrorNotice` (`item-list-page-notice.tsx`, replacing `ReloadNotice`). It is always in the page and only its text changes, so screen readers announce the error (the shared Notice rule, #684). With no error it is `sr-only` and takes no space.
- A failed first load now has a "Try again" button too; before, only the reload-after-delete error had one.
- Tests: `item-list-page.test.tsx` checks the empty alert region before the error, the first-load error, and retry to success; the reload test (#140) is unchanged.
- Verification: `npm run check` (results in the PR).
