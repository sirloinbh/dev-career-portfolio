-- Text limits in the database (#136): the API trims text and refuses blank and over-length values (backend/src/routes/*.ts);
-- these named CHECK constraints make a writer that skips the API follow the same rules. A required column must hold
-- non-blank text; an optional column is NULL or non-blank text (the API stores blank input as NULL). The limits are the
-- API's. Safe to run again: a constraint that already exists is skipped.
DO $$
DECLARE
  item record;
  cname text;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('educations', 'school', 100, true),
      ('educations', 'major', 100, false),
      ('educations', 'memo', 2000, false),
      ('careers', 'company', 100, true),
      ('careers', 'department', 100, false),
      ('careers', 'position', 100, false),
      ('careers', 'duties', 2000, false),
      ('careers', 'achievements', 2000, false),
      ('projects', 'name', 100, true),
      ('projects', 'organization', 100, false),
      ('projects', 'role', 100, false),
      ('projects', 'summary', 500, false),
      ('projects', 'contributions', 2000, false),
      ('projects', 'repository_url', 500, false),
      ('projects', 'service_url', 500, false),
      ('skills', 'name', 50, true),
      ('skills', 'memo', 2000, false),
      ('certifications', 'name', 100, true),
      ('certifications', 'issuer', 100, true),
      ('certifications', 'score', 50, false),
      ('certifications', 'memo', 2000, false),
      ('applications', 'company_name', 100, true),
      ('applications', 'position', 100, false),
      ('applications', 'posting_url', 500, false),
      ('applications', 'memo', 2000, false),
      ('cover_letter_questions', 'question', 500, true),
      ('cover_letter_questions', 'answer', 5000, false)
    ) AS limits (table_name, column_name, max_length, required)
  LOOP
    cname := item.table_name || '_' || item.column_name || '_text';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = cname) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s)',
        item.table_name,
        cname,
        format(
          CASE WHEN item.required THEN 'btrim(%1$I) <> '''' AND char_length(%1$I) <= %2$s'
               ELSE '%1$I IS NULL OR (btrim(%1$I) <> '''' AND char_length(%1$I) <= %2$s)' END,
          item.column_name,
          item.max_length
        )
      );
    END IF;
  END LOOP;
END
$$;
