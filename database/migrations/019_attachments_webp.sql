-- Attachments may also be WebP images (issue #286). 017 allowed PDF, PNG and JPEG only, so the content-type CHECK is
-- replaced by one that also lists image/webp. The constraint is dropped by name (PostgreSQL named the inline CHECK
-- from 017 attachments_content_type_check) and added back, so running this twice is safe.
ALTER TABLE attachments DROP CONSTRAINT IF EXISTS attachments_content_type_check;
ALTER TABLE attachments
  ADD CONSTRAINT attachments_content_type_check
  CHECK (content_type IN ('application/pdf', 'image/png', 'image/jpeg', 'image/webp'));
