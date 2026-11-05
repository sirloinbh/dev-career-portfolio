-- Certifications (issue #35). Entered here directly, not imported from the cert-manager app.
-- A certification that never expires keeps expiry_date NULL, never a placeholder date.
-- score is text because results come as "905점", "1급" or "IH". The same name may repeat:
-- each sitting of an exam is its own row.
CREATE TABLE IF NOT EXISTS certifications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL CHECK (name <> ''),
  issuer text NOT NULL CHECK (issuer <> ''),
  acquired_date date NOT NULL,
  expiry_date date,
  score text,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT certifications_period CHECK (expiry_date IS NULL OR expiry_date >= acquired_date)
);
