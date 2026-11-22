# Announce loading on the Edit pages (#196)

- `EditItemPage` and `EditQuestions` have an always-mounted `role="status"` that reads "Loading <noun>" (or "Loading questions") while the list is pending and is empty after. The skeleton stays `aria-hidden`, so before this the page was silent to screen readers.
- Tests: `item-form-page.test.tsx` (pending then loaded) and `cover-letter-form.test.tsx`.
- Verification: `npm run check` (DB integration tests skip locally).
