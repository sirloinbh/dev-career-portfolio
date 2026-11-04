-- Projects (issue #33). A project still running keeps end_date NULL, never a placeholder date.
-- technologies is a plain list of names for now, not linked to the skills table.
CREATE TABLE IF NOT EXISTS projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (name <> ''),
  organization text,
  start_date date NOT NULL,
  end_date date,
  role text,
  summary text,
  contributions text,
  technologies text[] NOT NULL DEFAULT '{}',
  repository_url text,
  service_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_period CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT projects_technologies_count CHECK (cardinality(technologies) <= 30),
  CONSTRAINT projects_links CHECK (
    (repository_url IS NULL OR repository_url ~* '^https?://')
    AND (service_url IS NULL OR service_url ~* '^https?://')
  )
);
