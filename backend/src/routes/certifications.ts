import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { calendarDate, objectBodyError, optionalText, requiredText } from './shared.js';

const certificationInput = z
  .object(
    {
      name: requiredText('자격증명', 100),
      issuer: requiredText('발급 기관', 100),
      acquiredDate: calendarDate('취득일'),
      // No expiry stays NULL. An expiry already past is still stored: the screen marks it (#46).
      expiryDate: calendarDate('만료일').nullable().default(null),
      // Text, not a number: results come as "905점", "1급" or "IH".
      score: optionalText('점수·등급', 50),
      memo: optionalText('메모', 2000),
    },
    objectBodyError,
  )
  .superRefine((input, ctx) => {
    // The same day is allowed; only an expiry before the acquisition is impossible.
    if (input.expiryDate !== null && input.expiryDate < input.acquiredDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: '만료일은 취득일보다 빠를 수 없습니다',
      });
    }
  });

type CertificationRow = { id: string } & Record<string, unknown>;

// bigint arrives as a string from pg, so the API casts it to a JSON number here.
const columns = `id::text AS id, name, issuer, acquired_date AS "acquiredDate",
  expiry_date AS "expiryDate", score, memo`;

const toCertification = (row: CertificationRow) => ({ ...row, id: Number(row.id) });

const notFoundError = () => new HttpError(404, '자격증을 찾을 수 없습니다');

export function registerCertificationRoutes(app: Express, pool: Pool) {
  app.get('/api/certifications', async (_req, res) => {
    const { rows } = await pool.query<CertificationRow>(
      // certifications.id, not id: a bare name would pick the text output column and sort "10"
      // before "9". The same acquisition date shows the one added last first.
      `SELECT ${columns} FROM certifications
       ORDER BY acquired_date DESC, certifications.id DESC`,
    );
    res.json({ certifications: rows.map(toCertification) });
  });

  app.post('/api/certifications', async (req, res) => {
    const input = certificationInput.parse(req.body);
    const { rows } = await pool.query<CertificationRow>(
      `INSERT INTO certifications (name, issuer, acquired_date, expiry_date, score, memo)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${columns}`,
      [input.name, input.issuer, input.acquiredDate, input.expiryDate, input.score, input.memo],
    );
    res.status(201).json({ certification: toCertification(rows[0]) });
  });

  app.put('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, '자격증');
    const input = certificationInput.parse(req.body);
    const { rows } = await pool.query<CertificationRow>(
      `UPDATE certifications
       SET name = $2, issuer = $3, acquired_date = $4, expiry_date = $5, score = $6, memo = $7,
           updated_at = now()
       WHERE id = $1
       RETURNING ${columns}`,
      [id, input.name, input.issuer, input.acquiredDate, input.expiryDate, input.score, input.memo],
    );
    if (rows.length === 0) throw notFoundError();
    res.json({ certification: toCertification(rows[0]) });
  });

  app.delete('/api/certifications/:id', async (req, res) => {
    const id = parseId(req.params.id, '자격증');
    const { rowCount } = await pool.query('DELETE FROM certifications WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
