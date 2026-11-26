# #259 Keep the career experience total independent of search and filter

After #238 the career list passed only the searched and filtered rows to the part that draws the total experience (#226), so searching changed the total.

| File                              | Change                                                                 |
| --------------------------------- | ---------------------------------------------------------------------- |
| `frontend/src/item-list-page.tsx` | `renderRows` gets a third argument, every row before search and filter |
| `frontend/src/careers.tsx`        | The total uses all careers; the list still shows the visible rows      |
| `frontend/src/careers.test.tsx`   | Filtering to one career keeps the total unchanged                      |

Note: when a search matches nothing, the "No entries match" message replaces the list, and the total is hidden with it.

## Checks

- `npm run check`: passed (DB integration tests skip locally; CI runs them).
- Browser check (mock API + vite, `?filter=intern`): at 1440x900 and 390x844 the list shows one career while the total stays 4 years 10 months; no horizontal scroll at 390.
