-- Hiring stages and status history for applications (issue #229).
-- applications.status grows from drafting / submitted / closed to eight stages (user decision 2026-11-27):
-- drafting, submitted, document_passed, first_interview, second_interview, offer, rejected, withdrawn.
-- Old `closed` rows become `rejected`; the other two old values keep their names.
-- application_status_history keeps one row per status change with its time. The API writes a row in the same
-- transaction as each change (and one when an application is created). Deleting the application deletes its history.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;

UPDATE applications SET status = 'rejected' WHERE status = 'closed';

ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK (
  status IN ('drafting', 'submitted', 'document_passed', 'first_interview', 'second_interview', 'offer', 'rejected', 'withdrawn')
);

CREATE TABLE IF NOT EXISTS application_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  -- NULL for the first row of an application.
  from_status text CHECK (from_status IS NULL OR from_status IN ('drafting', 'submitted', 'document_passed', 'first_interview', 'second_interview', 'offer', 'rejected', 'withdrawn')),
  status text NOT NULL CHECK (status IN ('drafting', 'submitted', 'document_passed', 'first_interview', 'second_interview', 'offer', 'rejected', 'withdrawn')),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS application_status_history_application_idx
  ON application_status_history (application_id, changed_at, id);

-- Applications that already exist get one row with their current status. The real dates of earlier changes were
-- never recorded, so the row is dated with the last time the application was edited.
INSERT INTO application_status_history (application_id, from_status, status, changed_at)
SELECT a.id, NULL, a.status, a.updated_at
FROM applications a
WHERE NOT EXISTS (SELECT 1 FROM application_status_history h WHERE h.application_id = a.id);
