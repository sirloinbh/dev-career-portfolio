import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { calendarDate, objectBodyError, oneOfError, optionalText, requiredText } from './shared.js';

const degrees = ['high_school', 'associate', 'bachelor', 'master', 'doctorate', 'other'] as const;
const statuses = ['graduated', 'enrolled', 'on_leave', 'dropped_out'] as const;

const hasTwoDecimalsAtMost = (value: number) => Math.round(value * 100) / 100 === value;

const gpaValue = (label: string) =>
  z
    .number({ error: `${label} must be a number` })
    .min(0, `${label} must be at least 0`)
    .max(100, `${label} must be at most 100`)
    .refine(hasTwoDecimalsAtMost, `${label} must have at most two decimal places`)
    .nullable()
    .default(null);

export const educationInput = z
  .object(
    {
      school: requiredText('School', 100),
      major: optionalText('Major', 100),
      degree: z.enum(degrees, {
        error: oneOfError('Degree', degrees),
      }),
      status: z.enum(statuses, {
        error: oneOfError('Status', statuses),
      }),
      startDate: calendarDate('Enrollment date'),
      endDate: calendarDate('Graduation date').nullable().default(null),
      gpa: gpaValue('GPA'),
      gpaScale: gpaValue('Maximum GPA'),
      memo: optionalText('Notes', 2000),
    },
    objectBodyError,
  )
  .superRefine((input, ctx) => {
    if (input.endDate !== null && input.endDate < input.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Graduation date cannot be earlier than the enrollment date',
      });
    }
    if (input.status === 'enrolled' && input.endDate !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'Graduation date must be empty while enrolled',
      });
    }
    // Report on the field that is empty, so the form shows the message under the right input.
    if (input.gpa !== null && input.gpaScale === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['gpaScale'],
        message: 'Maximum GPA is required when GPA is entered',
      });
    }
    if (input.gpa === null && input.gpaScale !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['gpa'],
        message: 'GPA is required when maximum GPA is entered',
      });
    }
    if (input.gpa !== null && input.gpaScale !== null) {
      if (input.gpaScale === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['gpaScale'],
          message: 'Maximum GPA must be greater than 0',
        });
      } else if (input.gpa > input.gpaScale) {
        ctx.addIssue({
          code: 'custom',
          path: ['gpa'],
          message: 'GPA cannot be greater than the maximum GPA',
        });
      }
    }
  });

type EducationRow = { id: number } & Record<string, unknown>;

// bigint and numeric arrive as strings from pg, so the API casts them to JSON numbers here.
const columns = `id, school, major, degree, status, start_date AS "startDate",
  end_date AS "endDate", gpa::float8 AS gpa, gpa_scale::float8 AS "gpaScale", memo`;

const notFoundError = () => new HttpError(404, 'Education not found');

export function registerEducationRoutes(app: Express, pool: Pool) {
  app.get('/api/educations', async (_req, res) => {
    const { rows } = await pool.query<EducationRow>(
      `SELECT ${columns} FROM educations ORDER BY start_date DESC, educations.id DESC`,
    );
    res.json({ educations: rows });
  });

  app.post('/api/educations', async (req, res) => {
    const input = educationInput.parse(req.body);
    const { rows } = await pool.query<EducationRow>(
      `INSERT INTO educations (school, major, degree, status, start_date, end_date, gpa, gpa_scale, memo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${columns}`,
      [
        input.school,
        input.major,
        input.degree,
        input.status,
        input.startDate,
        input.endDate,
        input.gpa,
        input.gpaScale,
        input.memo,
      ],
    );
    res.status(201).json({ education: rows[0] });
  });

  app.put('/api/educations/:id', async (req, res) => {
    const id = parseId(req.params.id, 'education');
    const input = educationInput.parse(req.body);
    const { rows } = await pool.query<EducationRow>(
      `UPDATE educations
       SET school = $2, major = $3, degree = $4, status = $5, start_date = $6, end_date = $7,
           gpa = $8, gpa_scale = $9, memo = $10, updated_at = now()
       WHERE id = $1
       RETURNING ${columns}`,
      [
        id,
        input.school,
        input.major,
        input.degree,
        input.status,
        input.startDate,
        input.endDate,
        input.gpa,
        input.gpaScale,
        input.memo,
      ],
    );
    if (rows.length === 0) throw notFoundError();
    res.json({ education: rows[0] });
  });

  app.delete('/api/educations/:id', async (req, res) => {
    const id = parseId(req.params.id, 'education');
    const { rowCount } = await pool.query('DELETE FROM educations WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
