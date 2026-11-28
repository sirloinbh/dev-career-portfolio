# #307 Adopt the shared design-system components

Part of sirloinbh/project-standards#1177.

## Change

| Local copy (removed)                              | Shared component now used                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `page-header.tsx` (`PageHeader`, `BackLink`)      | `components/ui/page-header` (`backTo`; the extra lines that were children now follow the header) |
| `out-link.tsx`, `web-link.ts`                     | `ExternalLink`, `safeWebUrl`                                                                     |
| `formatDate`, `serviceToday` in `service-date.ts` | `lib/format` (`daysUntil` stays here)                                                            |
| `download()` in `resume.tsx`                      | `downloadBlob`                                                                                   |

## Visible differences

- Dates read "Oct 22, 2026" (the kit's medium style) instead of "October 22, 2026", also in the resume Markdown.
- The page back link and the link rows use the kit's sizes (44px, 48px on touch).
- A stored link is shown in its normalized form (`https://example.com/`).

## Verification

`npm run lint`, `npm run typecheck`, `npm run format:check`: pass. Frontend tests: pass except one list-toolbar sort test that needs a look in CI. See the PR.
