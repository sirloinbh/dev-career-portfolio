# Shared shell for the New and Edit screens (#144)

- New `frontend/src/item-form-page.tsx` with `NewItemPage` and `EditItemPage`. They hold what the six entities repeated: the back link and title, the Edit loading, error, not-found and invalid-address states, finding the row in the list, the "Added '…'" and "Saved" toasts, and the step back to the list.
- Each screen file keeps only its api calls, texts and `…Fields` form: `NewCareer`/`EditCareer` and the same for education, project, skill, certification and application are now short wrappers. The six screen files shrink from 2147 to 1830 lines (the new shell is about 125 lines).
- `frontend/src/item-form-page.test.tsx` tests the shell once with a stand-in form. The six "editing … that no longer exists says so" form tests only re-checked the shell, so they were removed; the not-found text, the load error, the malformed id and a failed save are covered there. The certification malformed-address test from #141 stays as the check through a real screen.
- Cover letter questions keep their own screens (not part of this card).
- Verification: `npm run check` (DB integration tests skip locally).
