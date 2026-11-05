-- Applications (issue #36): one row per job applied for at one company, so the same company can
-- appear once per position or hiring round. Cover letter questions (#37) belong to a row here.
-- No deadline keeps deadline NULL, never a placeholder date.
CREATE TABLE IF NOT EXISTS applications (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name text NOT NULL CHECK (company_name <> ''),
  position text,
  posting_url text CHECK (posting_url IS NULL OR posting_url ~* '^https?://'),
  deadline date,
  status text NOT NULL CHECK (status IN ('drafting', 'submitted', 'closed')),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
