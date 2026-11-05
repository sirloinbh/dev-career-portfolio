-- Cover letter questions (issue #37): the questions one application asks, with the draft answer.
-- Deleting the application deletes its questions. No character limit keeps char_limit NULL. An answer
-- longer than the limit is still stored: the screen warns instead.
-- The order is unique per application but checked at commit, so one save can swap two questions.
CREATE TABLE IF NOT EXISTS cover_letter_questions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  application_id bigint NOT NULL REFERENCES applications (id) ON DELETE CASCADE,
  question text NOT NULL CHECK (question <> ''),
  answer text,
  char_limit integer CHECK (char_limit BETWEEN 1 AND 5000),
  display_order integer NOT NULL CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cover_letter_questions_order UNIQUE (application_id, display_order)
    DEFERRABLE INITIALLY DEFERRED
);
