-- Work history (issue #32). A job still held keeps end_date NULL, never a placeholder date.
-- A move or promotion inside one company is a separate row for now.
CREATE TABLE IF NOT EXISTS careers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company text NOT NULL CHECK (company <> ''),
  department text,
  position text,
  employment_type text NOT NULL CHECK (
    employment_type IN ('full_time', 'contract', 'intern', 'freelance', 'other')
  ),
  start_date date NOT NULL,
  end_date date,
  duties text,
  achievements text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT careers_period CHECK (end_date IS NULL OR end_date >= start_date)
);
