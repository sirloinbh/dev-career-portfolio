-- Project technology items in the database (#191, follow-up to #136). projects.technologies is a text[]; the API
-- (backend/src/routes/projects.ts) trims each item and refuses a blank one or one over 50 characters, but the table
-- only checked the count. This function tells whether every item is non-blank and at most 50 characters, and a named
-- CHECK uses it, so a writer that skips the API follows the same rules. Safe to run again: the function is replaced
-- and an existing constraint is skipped.
CREATE OR REPLACE FUNCTION projects_technologies_valid(items text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    bool_and(item IS NOT NULL AND btrim(item) <> '' AND char_length(item) <= 50),
    true
  )
  FROM unnest(items) AS item
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_technologies_items') THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_technologies_items CHECK (projects_technologies_valid(technologies));
  END IF;
END
$$;
