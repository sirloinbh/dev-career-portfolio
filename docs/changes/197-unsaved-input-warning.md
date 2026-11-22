# Warn before losing unsaved input (#197)

- User decision (via coordinator, 2026-11-22): a `beforeunload` prompt plus a confirm on Cancel when the form has changes. Blocking in-app links stays out of scope (`BrowserRouter` has no blocker; no `app.tsx` change).
- `useServerForm` tracks `dirty`: any change event that reaches the form (the `onChange={clearOnEdit}` from #195) or `markDirty()` (cover letter add, move, remove, which raise no change event) sets it; a successful save clears it.
- While dirty, a `beforeunload` handler asks the browser to confirm a reload or a closed tab. Cancel becomes a button that opens "Discard what you typed?" ("Keep editing" / "Discard"); an untouched form keeps the plain Cancel link.
- "Changed" means edited at least once; typing a value back does not clear it.
- Tests: untouched form, changed form (reload, Keep editing, Discard), after a save, and the cover letter question controls.
- Verification: `npm run check` (DB integration tests skip locally).
