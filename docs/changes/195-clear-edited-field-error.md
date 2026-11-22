# Clear a field's server message when it is edited (#195)

- `useServerForm` returns `clearOnEdit`, which the seven forms (six items and the cover letter form) set as the form's `onChange`. Change events bubble up to the form; the message under the edited field and its `aria-invalid` go at once, and the other fields keep theirs.
- A group counts as one field: the proficiency radios (ids `<field>-<n>`) clear the proficiency message.
- Tests: a flat form (career), the radio group (skill) and a cover letter question field.
- Verification: `npm run check` (DB integration tests skip locally).
