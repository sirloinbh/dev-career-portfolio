import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { withTransaction } from '../standard/db.js';
import { HttpError, parseId } from '../standard/http.js';
import {
  calendarDate,
  objectBodyError,
  oneOfError,
  optionalLink,
  optionalText,
  requiredText,
} from './shared.js';

// The hiring stages, in the order the list shows them (issues #36, #229): the ones still going first, then the ended
// ones. `closed` of the first version became `rejected` (migration 013).
const statuses = [
  'drafting',
  'submitted',
  'document_passed',
  'first_interview',
  'second_interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;

export const applicationInput = z.object(
  {
    companyName: requiredText('Company name', 100),
    position: optionalText('Position', 100),
    postingUrl: optionalLink('Job posting link'),
    // No deadline stays NULL. A deadline already past is still stored: it is a past application.
    deadline: calendarDate('Deadline').nullable().default(null),
    status: z.enum(statuses, {
      error: oneOfError('Application status', statuses),
    }),
    memo: optionalText('Notes', 2000),
  },
  objectBodyError,
);

type ApplicationRow = { id: number } & Record<string, unknown>;

const columns = `id, company_name AS "companyName", position,
  posting_url AS "postingUrl", deadline, status, memo`;

const notFoundError = () => new HttpError(404, 'Application not found');

export function registerApplicationRoutes(app: Express, pool: Pool, today: () => string) {
  app.get('/api/applications', async (_req, res) => {
    // Status in the fixed order above. Inside drafting, a deadline already past (before today in
    // the service time zone; due today is not past, #83) goes after the rest, no deadline included.
    // Then the nearest deadline (none last), then the one added last.
    const { rows } = await pool.query<ApplicationRow>(
      `SELECT ${columns} FROM applications
       ORDER BY array_position($1::text[], status),
         COALESCE(status = 'drafting' AND deadline < $2::date, false),
         deadline ASC NULLS LAST, applications.id DESC`,
      [statuses, today()],
    );
    res.json({ applications: rows });
  });

  app.post('/api/applications', async (req, res) => {
    const input = applicationInput.parse(req.body);
    const created = await withTransaction<ApplicationRow, PoolClient>(pool, async (client) => {
      const { rows } = await client.query<ApplicationRow>(
        `INSERT INTO applications (company_name, position, posting_url, deadline, status, memo)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${columns}`,
        [
          input.companyName,
          input.position,
          input.postingUrl,
          input.deadline,
          input.status,
          input.memo,
        ],
      );
      // The first row of the history: the stage the application started in.
      await client.query(
        `INSERT INTO application_status_history (application_id, from_status, status)
         VALUES ($1, NULL, $2)`,
        [rows[0].id, input.status],
      );
      return rows[0];
    });
    res.status(201).json({ application: created });
  });

  app.put('/api/applications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'application');
    const input = applicationInput.parse(req.body);
    const updated = await withTransaction<ApplicationRow, PoolClient>(pool, async (client) => {
      // The row lock makes two saves of the same application run one after another, so each change
      // is compared with the status the previous one left.
      const current = await client.query<{ status: string }>(
        'SELECT status FROM applications WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (current.rows.length === 0) throw notFoundError();
      const { rows } = await client.query<ApplicationRow>(
        `UPDATE applications
         SET company_name = $2, position = $3, posting_url = $4, deadline = $5, status = $6,
             memo = $7, updated_at = now()
         WHERE id = $1
         RETURNING ${columns}`,
        [
          id,
          input.companyName,
          input.position,
          input.postingUrl,
          input.deadline,
          input.status,
          input.memo,
        ],
      );
      // One history row for a real change of stage; saving other fields writes none.
      if (current.rows[0].status !== input.status) {
        await client.query(
          `INSERT INTO application_status_history (application_id, from_status, status)
           VALUES ($1, $2, $3)`,
          [id, current.rows[0].status, input.status],
        );
      }
      return rows[0];
    });
    res.json({ application: updated });
  });

  // The stage changes of one application, oldest first, each with its day in the service time zone.
  app.get('/api/applications/:id/status-history', async (req, res) => {
    const id = parseId(req.params.id, 'application');
    const found = await pool.query('SELECT 1 FROM applications WHERE id = $1', [id]);
    if (found.rowCount === 0) throw notFoundError();
    const { rows } = await pool.query(
      `SELECT id, from_status AS "fromStatus", status,
              to_char(changed_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date
       FROM application_status_history
       WHERE application_id = $1
       ORDER BY changed_at, id`,
      [id],
    );
    res.json({ history: rows });
  });

  app.delete('/api/applications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'application');
    const { rowCount } = await pool.query('DELETE FROM applications WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
