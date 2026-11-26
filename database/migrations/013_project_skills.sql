-- Project technologies become links to the skills table (#225). A project_skills row says one skill was used in
-- one project; deleting either side deletes the link. The old projects.technologies names are moved in first:
-- a name matches a skill ignoring letter case and surrounding spaces, and a name with no match becomes a new
-- skill (category 'other', proficiency 1, so it can be fixed on the Skills screen). Then the column is dropped,
-- with its CHECK constraints and the helper function from 011. Safe to run again: the move runs only while the
-- column exists.
CREATE TABLE IF NOT EXISTS project_skills (
  project_id bigint NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  skill_id bigint NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, skill_id)
);
CREATE INDEX IF NOT EXISTS project_skills_skill_id_idx ON project_skills (skill_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'projects' AND column_name = 'technologies'
  ) THEN
    INSERT INTO skills (name, category, proficiency, memo)
    SELECT DISTINCT ON (lower(btrim(t.name))) btrim(t.name), 'other', 1, 'Created from project technologies (#225)'
    FROM projects p
    CROSS JOIN LATERAL unnest(p.technologies) AS t (name)
    WHERE btrim(t.name) <> ''
    ORDER BY lower(btrim(t.name)), p.id
    ON CONFLICT ((lower(name))) DO NOTHING;

    INSERT INTO project_skills (project_id, skill_id)
    SELECT DISTINCT p.id, s.id
    FROM projects p
    CROSS JOIN LATERAL unnest(p.technologies) AS t (name)
    JOIN skills s ON lower(s.name) = lower(btrim(t.name))
    WHERE btrim(t.name) <> ''
    ON CONFLICT DO NOTHING;

    ALTER TABLE projects DROP COLUMN technologies;
  END IF;
END $$;

DROP FUNCTION IF EXISTS projects_technologies_valid(text[]);
