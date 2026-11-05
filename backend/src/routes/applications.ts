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

const applicationInput = z.object(
  {
    companyName: requiredText('기업명', 100),
    position: optionalText('지원 직무', 100),
    postingUrl: optionalLink('채용 공고 링크'),
    // No deadline stays NULL. A deadline already past is still stored: it is a past application.
    deadline: calendarDate('마감일').nullable().default(null),
    status: z.enum(statuses, {
      error: '지원 상태는 작성 중, 제출 완료, 종료 중 하나여야 합니다',
    }),
    memo: optionalText('메모', 2000),
  },
  objectBodyError,
);

type ApplicationRow = { id: string } & Record<string, unknown>;

// bigint arrives as a string from pg, so the API casts it to a JSON number here.
const columns = `id::text AS id, company_name AS "companyName", position,
  posting_url AS "postingUrl", deadline, status, memo`;

const toApplication = (row: ApplicationRow) => ({ ...row, id: Number(row.id) });

const notFoundError = () => new HttpError(404, '지원 기업을 찾을 수 없습니다');

export function registerApplicationRoutes(app: Express, pool: Pool) {
  app.get('/api/applications', async (_req, res) => {
    // Status in the fixed order above, then the nearest deadline (none last), then the one added
    // last. applications.id, not id: a bare name would pick the text output column.
    const { rows } = await pool.query<ApplicationRow>(
      `SELECT ${columns} FROM applications
       ORDER BY array_position($1::text[], status), deadline ASC NULLS LAST, applications.id DESC`,
      [statuses],
    );
    res.json({ applications: rows.map(toApplication) });
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
    res.status(201).json({ application: toApplication(rows[0]) });
  });

  app.put('/api/applications/:id', async (req, res) => {
    const id = parseId(req.params.id, '지원 기업');
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
    res.json({ application: toApplication(rows[0]) });
  });

  app.delete('/api/applications/:id', async (req, res) => {
    const id = parseId(req.params.id, '지원 기업');
    const { rowCount } = await pool.query('DELETE FROM applications WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
