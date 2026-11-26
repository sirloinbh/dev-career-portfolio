-- Project technologies become links to the skills table (#225). A project_skills row says one skill was used in
-- one project; deleting either side deletes the link. The old projects.technologies names are moved in first:
-- a name matches a skill ignoring letter case and surrounding spaces, and a name with no match becomes a new
-- skill (category 'other', proficiency 1, so it can be fixed on the Skills screen). The names are then cleared
-- from the column, so running this file again moves nothing and cannot bring back a link or skill that was
-- removed on purpose. The column itself stays, unused and empty: CI (and a rebuild from scratch) runs every file
-- twice, and 011 still refers to the column, so dropping it here would break the second run. Safe to run again.
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

    UPDATE projects SET technologies = '{}' WHERE cardinality(technologies) > 0;
  END IF;
END $$;
