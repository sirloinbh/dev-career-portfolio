-- Education history (issue #31). An unfinished course keeps end_date NULL, never a placeholder date.
-- gpa and gpa_scale are optional but only make sense together.
CREATE TABLE IF NOT EXISTS educations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  school text NOT NULL CHECK (school <> ''),
  major text,
  degree text NOT NULL CHECK (
    degree IN ('high_school', 'associate', 'bachelor', 'master', 'doctorate', 'other')
  ),
  status text NOT NULL CHECK (status IN ('graduated', 'enrolled', 'on_leave', 'dropped_out')),
  start_date date NOT NULL,
  end_date date,
  gpa numeric(5, 2),
  gpa_scale numeric(5, 2),
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT educations_period CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT educations_enrolled_open CHECK (status <> 'enrolled' OR end_date IS NULL),
  CONSTRAINT educations_gpa_pair CHECK ((gpa IS NULL) = (gpa_scale IS NULL)),
  CONSTRAINT educations_gpa_range CHECK (
    gpa IS NULL OR (gpa >= 0 AND gpa_scale > 0 AND gpa_scale <= 100 AND gpa <= gpa_scale)
  )
);
