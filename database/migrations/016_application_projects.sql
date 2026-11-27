-- The projects an application highlights (issue #234): which of the stored projects to put forward for one job
-- application. Deleting the application or a project removes the link.
CREATE TABLE IF NOT EXISTS application_projects (
  application_id bigint NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  project_id bigint NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  PRIMARY KEY (application_id, project_id)
);

CREATE INDEX IF NOT EXISTS application_projects_project_idx ON application_projects (project_id);
