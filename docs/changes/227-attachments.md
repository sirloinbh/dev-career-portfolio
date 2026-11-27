# Attach files to certifications and projects (#227)

A certification or a project can hold uploaded files (a certificate scan, a portfolio PDF). They are shown under its Edit form, can be downloaded, and are deleted with the item.

User decision 2026-11-27 (recorded on #227): files are stored in the database as `bytea`, at most 5 MB each; `multer` is installed for the upload; the JSON export embeds files as base64. The allowed types were not set by the user: the default is **PDF, PNG and JPEG** (FYI for the user to confirm).

- Migration `017_attachments.sql`: table `attachments` (owner is exactly one of `certification_id` / `project_id`, both `ON DELETE CASCADE`; `filename`, `content_type`, `size_bytes`, `data bytea`; the 5 MB size and the three types are CHECK constraints too).
- API (`backend/src/routes/attachments.ts`): `GET` and `POST /api/certifications/:id/attachments` and `/api/projects/:id/attachments` (multipart, one `file` field, memory storage, 5 MB limit), `GET /api/attachments/:id` (download), `DELETE /api/attachments/:id`.
- The type is decided from the file's first bytes (`%PDF-`, PNG and JPEG signatures), not from the name or the browser's type. Names are kept as UTF-8, stripped of folders and control characters, at most 200 characters. Downloads are `attachment` with `X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`.
- Frontend: `attachment-section.tsx` / `attachment-data.ts`, mounted under the Edit form of a certification and of a project. Files are saved at once (not with the form's Save). The browser refuses a file over 5 MB before sending it.
- Export/import: `attachments` is in `dataTables`; `data` is base64 in the file. The import body limit rose from 20 MB to 100 MB so a file with several attachments fits.
- Backup: `pg_dump` backups include the table with everything else.
- New packages (approved by the user): `multer`, `@types/multer` (dev), installed with `--ignore-scripts`.

| File                                                                                  | Change                                    |
| ------------------------------------------------------------------------------------- | ----------------------------------------- |
| `database/migrations/017_attachments.sql`                                             | Table                                     |
| `backend/src/routes/attachments.ts`, `app.ts`, `openapi.ts`, `routes/data.ts`         | Routes, registration, docs, export/import |
| `backend/package.json`, `package-lock.json`                                           | multer                                    |
| `backend/test/attachments*.test.ts`, `attachment-upload.ts`, `data-transfer*.test.ts` | Tests                                     |
| `frontend/src/attachment-*.ts(x)`, `certifications.tsx`, `projects.tsx`               | Section and mounting                      |
| `docs/openapi.json`, `docs/data-format.md`                                            | Regenerated / updated                     |

Tests: upload, wrong type, too large, missing field, bad id and filename cleaning run locally with a fake pool. The DB integration tests (upload, list, exact-bytes download, delete, cascade on item delete, base64 round trip with non-UTF-8 bytes) are skipped without `TEST_DATABASE_URL`, so CI is their proof. Screen tests cover list, upload, the 5 MB refusal, a server refusal and delete.
