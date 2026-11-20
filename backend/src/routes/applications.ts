import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import {
  calendarDate,
  objectBodyError,
  optionalLink,
  optionalText,
  requiredText,
} from './shared.js';

// The list shows the statuses in this order (issue #36).
const statuses = ['drafting', 'submitted', 'closed'] as const;

export const applicationInput = z.object(
  {
    companyName: requiredText('Company name', 100),
    position: optionalText('Position', 100),
    postingUrl: optionalLink('Job posting link'),
    // No deadline stays NULL. A deadline already past is still stored: it is a past application.
    deadline: calendarDate('Deadline').nullable().default(null),
    status: z.enum(statuses, {
      error: 'Application status must be one of drafting, submitted, closed',
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
    const { rows } = await pool.query<ApplicationRow>(
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
    res.status(201).json({ application: rows[0] });
  });

  app.put('/api/applications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'application');
    const input = applicationInput.parse(req.body);
    const { rows } = await pool.query<ApplicationRow>(
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
    if (rows.length === 0) throw notFoundError();
    res.json({ application: rows[0] });
  });

  app.delete('/api/applications/:id', async (req, res) => {
    const id = parseId(req.params.id, 'application');
    const { rowCount } = await pool.query('DELETE FROM applications WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
