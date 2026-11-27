-- Files attached to a certification or a project (issue #227). The bytes live in the database (bytea, at most 5 MB
-- per file, checked by the API and again here), so the pg_dump backup and the JSON export carry them. Deleting the
-- certification or project removes its files.
CREATE TABLE IF NOT EXISTS attachments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  certification_id bigint REFERENCES certifications (id) ON DELETE CASCADE,
  project_id bigint REFERENCES projects (id) ON DELETE CASCADE,
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 200),
  content_type text NOT NULL CHECK (content_type IN ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  data bytea NOT NULL CHECK (octet_length(data) = size_bytes),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A file belongs to exactly one item.
  CONSTRAINT attachments_one_owner CHECK ((certification_id IS NULL) <> (project_id IS NULL))
);

CREATE INDEX IF NOT EXISTS attachments_certification_idx ON attachments (certification_id);
CREATE INDEX IF NOT EXISTS attachments_project_idx ON attachments (project_id);
