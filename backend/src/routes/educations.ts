import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { calendarDate, objectBodyError, optionalText, requiredText } from './shared.js';

const degrees = ['high_school', 'associate', 'bachelor', 'master', 'doctorate', 'other'] as const;
const statuses = ['graduated', 'enrolled', 'on_leave', 'dropped_out'] as const;

const hasTwoDecimalsAtMost = (value: number) => Math.round(value * 100) / 100 === value;

const gpaValue = (label: string) =>
  z
    .number({ error: `${label}은(는) 숫자여야 합니다` })
    .min(0, `${label}은(는) 0 이상이어야 합니다`)
    .max(100, `${label}은(는) 100 이하여야 합니다`)
    .refine(hasTwoDecimalsAtMost, `${label}은(는) 소수 둘째 자리까지 입력해 주세요`)
    .nullable()
    .default(null);

const educationInput = z
  .object(
    {
      school: requiredText('학교명', 100),
      major: optionalText('전공', 100),
      degree: z.enum(degrees, {
        error: '학위는 고등학교, 전문학사, 학사, 석사, 박사, 기타 중 하나여야 합니다',
      }),
      status: z.enum(statuses, { error: '상태는 졸업, 재학, 휴학, 중퇴 중 하나여야 합니다' }),
      startDate: calendarDate('입학일'),
      endDate: calendarDate('졸업일').nullable().default(null),
      gpa: gpaValue('학점'),
      gpaScale: gpaValue('만점'),
      memo: optionalText('메모', 2000),
    },
    objectBodyError,
  )
  .superRefine((input, ctx) => {
    if (input.endDate !== null && input.endDate < input.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '졸업일은 입학일보다 빠를 수 없습니다',
      });
    }
    if ((input.gpa === null) !== (input.gpaScale === null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['gpa'],
        message: '학점과 만점은 함께 입력해 주세요',
      });
    }
    if (input.gpa !== null && input.gpaScale !== null) {
      if (input.gpaScale === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['gpaScale'],
          message: '만점은 0보다 커야 합니다',
        });
      } else if (input.gpa > input.gpaScale) {
        ctx.addIssue({
          code: 'custom',
          path: ['gpa'],
          message: '학점은 만점보다 클 수 없습니다',
        });
      }
    }
  });

type EducationRow = { id: string } & Record<string, unknown>;

// bigint and numeric arrive as strings from pg, so the API casts them to JSON numbers here.
const columns = `id::text AS id, school, major, degree, status, start_date AS "startDate",
  end_date AS "endDate", gpa::float8 AS gpa, gpa_scale::float8 AS "gpaScale", memo`;

const toEducation = (row: EducationRow) => ({ ...row, id: Number(row.id) });

const notFoundError = () => new HttpError(404, '학력을 찾을 수 없습니다');

export function registerEducationRoutes(app: Express, pool: Pool) {
  app.get('/api/educations', async (_req, res) => {
    const { rows } = await pool.query<EducationRow>(
      `SELECT ${columns} FROM educations ORDER BY start_date DESC, id DESC`,
    );
    res.json({ educations: rows.map(toEducation) });
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
    res.status(201).json({ education: toEducation(rows[0]) });
  });

  app.put('/api/educations/:id', async (req, res) => {
    const id = parseId(req.params.id, '학력');
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
    res.json({ education: toEducation(rows[0]) });
  });

  app.delete('/api/educations/:id', async (req, res) => {
    const id = parseId(req.params.id, '학력');
    const { rowCount } = await pool.query('DELETE FROM educations WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
