# Allow WebP images as attachments (#286)

User decision 2026-11-27 (recorded on #227): attachments also accept WebP, besides PDF, PNG and JPEG, so phone screenshots and modern image exports can be attached without converting them.

- `sniffType` (`backend/src/routes/attachments.ts`) recognises WebP by its RIFF container: `RIFF`, a 4-byte size, then `WEBP`. A RIFF file that is not WebP (a WAV) and a file that only claims `.webp` in its name are refused like any other wrong type.
- Migration `019_attachments_webp.sql` replaces the content-type CHECK from 017 with one that also lists `image/webp` (017 is not edited; the migration drops and re-adds the constraint by name, so it can run twice).
- Frontend: the file picker accepts `image/webp` / `.webp`, and the hint reads "PDF, PNG, JPEG or WebP". The API error text and the OpenAPI summaries say the same.
- `docs/data-format.md` lists no types, so it needs no change; the export already carries `content_type` as text and the import goes through the new CHECK.

| File                                                                              | Change               |
| --------------------------------------------------------------------------------- | -------------------- |
| `database/migrations/019_attachments_webp.sql`                                    | Widen the CHECK      |
| `backend/src/routes/attachments.ts`, `openapi.ts`, `docs/openapi.json`            | Sniff WebP, texts    |
| `frontend/src/attachment-data.ts`, `attachment-section.tsx`                       | Accept list and hint |
| `backend/test/attachments*.test.ts`, `attachment-upload.ts`, frontend screen test | WebP tests           |

Tests: sniffing (WebP accepted; WAV and a bare `RIFF` refused) and a WebP upload stored as `image/webp` run locally with a fake pool. The DB integration test (WebP stored, listed and downloaded with `image/webp`, which exercises migration 019) is skipped without `TEST_DATABASE_URL`, so CI is its proof.
