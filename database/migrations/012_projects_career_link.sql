-- A project can point to the career entry it was done at (#224). Deleting the career keeps the project and
-- clears the link. projects.organization stays: it is the free-text name for a project outside any career
-- (side project, school) and is used only when no career is linked. Safe to run again.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS career_id bigint REFERENCES careers (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS projects_career_id_idx ON projects (career_id);
