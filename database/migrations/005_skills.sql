-- Skills (issue #34). Proficiency is a 1-5 score; the screen (#45) explains each step.
-- Not linked to projects.technologies, which stays a plain list of names (#33).
CREATE TABLE IF NOT EXISTS skills (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (name <> ''),
  category text NOT NULL CHECK (
    category IN ('language', 'framework', 'database', 'infrastructure', 'tool', 'other')
  ),
  proficiency smallint NOT NULL CHECK (proficiency BETWEEN 1 AND 5),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per skill name, whatever the category or letter case: "React" and "react" are the same.
CREATE UNIQUE INDEX IF NOT EXISTS skills_name_unique ON skills (lower(name));
