import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { calendarDate, objectBodyError, oneOfError, optionalText } from './shared.js';

// Interviews of one application (#230). The time is a day and a clock time in the service time zone (Asia/Seoul),
// the same as every other date in the app; the table keeps the instant.
const formats = ['phone', 'video', 'onsite'] as const;

const roundError = 'Round must be a whole number from 1 to 20';
const timeError = 'Time must be in HH:MM format, from 00:00 to 23:59';

export const interviewInput = z.object(
  {
    round: z.int({ error: roundError }).min(1, roundError).max(20, roundError),
    date: calendarDate('Date'),
    time: z.string({ error: timeError }).regex(/^([01]\d|2[0-3]):[0-5]\d$/, timeError),
    format: z.enum(formats, { error: oneOfError('Format', formats) }),
    questions: optionalText('Questions', 5000),
    retrospective: optionalText('Retrospective', 5000),
  },
  objectBodyError,
);

type InterviewRow = { id: number } & Record<string, unknown>;

// The day and time are read back in Asia/Seoul, so what was typed is what is shown, wherever the server runs.
const columns = `id, round, format, questions, retrospective,
  to_char(scheduled_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date,
  to_char(scheduled_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI') AS time`;

const applicationNotFound = () => new HttpError(404, 'Application not found');
const interviewNotFound = () => new HttpError(404, 'Interview not found');

export function registerInterviewRoutes(app: Express, pool: Pool) {
  // Oldest first: the order the rounds happen in.
  app.get('/api/applications/:id/interviews', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const found = await pool.query('SELECT 1 FROM applications WHERE id = $1', [applicationId]);
    if (found.rowCount === 0) throw applicationNotFound();
    const { rows } = await pool.query<InterviewRow>(
      `SELECT ${columns} FROM interviews
       WHERE application_id = $1 ORDER BY scheduled_at, id`,
      [applicationId],
    );
    res.json({ interviews: rows });
  });

  app.post('/api/applications/:id/interviews', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const input = interviewInput.parse(req.body);
    // One statement that inserts from the application's own row: when the application is gone (or deleted a moment
    // ago) nothing is inserted and the answer is a 404, never a foreign key error.
    // The Seoul wall clock becomes an instant with AT TIME ZONE (a fixed +09:00, no daylight saving).
    const { rows } = await pool.query<InterviewRow>(
      `INSERT INTO interviews (application_id, round, scheduled_at, format, questions, retrospective)
       SELECT a.id, $2::integer, ($3::date + $4::time) AT TIME ZONE 'Asia/Seoul', $5::text, $6::text, $7::text
       FROM applications a WHERE a.id = $1
       RETURNING ${columns}`,
      [
        applicationId,
        input.round,
        input.date,
        input.time,
        input.format,
        input.questions,
        input.retrospective,
      ],
    );
    if (rows.length === 0) throw applicationNotFound();
    res.status(201).json({ interview: rows[0] });
  });

  app.put('/api/applications/:id/interviews/:interviewId', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const interviewId = parseId(req.params.interviewId, 'interview');
    const input = interviewInput.parse(req.body);
    const { rows } = await pool.query<InterviewRow>(
      `UPDATE interviews
       SET round = $3, scheduled_at = ($4::date + $5::time) AT TIME ZONE 'Asia/Seoul', format = $6,
           questions = $7, retrospective = $8, updated_at = now()
       WHERE id = $1 AND application_id = $2
       RETURNING ${columns}`,
      [
        interviewId,
        applicationId,
        input.round,
        input.date,
        input.time,
        input.format,
        input.questions,
        input.retrospective,
      ],
    );
    if (rows.length === 0) throw interviewNotFound();
    res.json({ interview: rows[0] });
  });

  app.delete('/api/applications/:id/interviews/:interviewId', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const interviewId = parseId(req.params.interviewId, 'interview');
    const { rowCount } = await pool.query(
      'DELETE FROM interviews WHERE id = $1 AND application_id = $2',
      [interviewId, applicationId],
    );
    if (rowCount === 0) throw interviewNotFound();
    res.status(204).end();
  });
}
