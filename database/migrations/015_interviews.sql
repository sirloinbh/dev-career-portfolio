-- Interviews of an application (issue #230): when, which round, in what format, the questions asked and a
-- retrospective note. scheduled_at is an instant; the API reads and writes it as a day and a time in Asia/Seoul.
-- Deleting the application deletes its interviews.
CREATE TABLE IF NOT EXISTS interviews (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  round integer NOT NULL CHECK (round BETWEEN 1 AND 20),
  scheduled_at timestamptz NOT NULL,
  format text NOT NULL CHECK (format IN ('phone', 'video', 'onsite')),
  questions text CHECK (questions IS NULL OR (questions <> '' AND char_length(questions) <= 5000)),
  retrospective text CHECK (retrospective IS NULL OR (retrospective <> '' AND char_length(retrospective) <= 5000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interviews_application_idx ON interviews (application_id, scheduled_at, id);
