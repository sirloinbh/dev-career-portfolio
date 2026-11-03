import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { calendarDate, objectBodyError, optionalText, requiredText } from './shared.js';

const employmentTypes = ['full_time', 'contract', 'intern', 'freelance', 'other'] as const;

// An empty end date means the job is still held, so there is no separate status field.
const careerInput = z
  .object(
    {
      company: requiredText('회사명', 100),
      department: optionalText('부서', 100),
      position: optionalText('직책', 100),
      employmentType: z.enum(employmentTypes, {
        error: '고용 형태는 정규직, 계약직, 인턴, 프리랜서, 기타 중 하나여야 합니다',
      }),
      startDate: calendarDate('입사일'),
      endDate: calendarDate('퇴사일').nullable().default(null),
      duties: optionalText('담당 업무', 2000),
      achievements: optionalText('주요 성과', 2000),
    },
    objectBodyError,
  )
  .superRefine((input, ctx) => {
    if (input.endDate !== null && input.endDate < input.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '퇴사일은 입사일보다 빠를 수 없습니다',
      });
    }
  });

type CareerRow = { id: string } & Record<string, unknown>;

// bigint arrives as a string from pg, so the API casts it to a JSON number here.
const columns = `id::text AS id, company, department, position, employment_type AS "employmentType",
  start_date AS "startDate", end_date AS "endDate", duties, achievements`;

const toCareer = (row: CareerRow) => ({ ...row, id: Number(row.id) });

const notFoundError = () => new HttpError(404, '이력을 찾을 수 없습니다');

export function registerCareerRoutes(app: Express, pool: Pool) {
  app.get('/api/careers', async (_req, res) => {
    const { rows } = await pool.query<CareerRow>(
      // careers.id, not id: a bare name would pick the text output column and sort "10" before "9".
      `SELECT ${columns} FROM careers ORDER BY start_date DESC, careers.id DESC`,
    );
    res.json({ careers: rows.map(toCareer) });
  });

  app.post('/api/careers', async (req, res) => {
    const input = careerInput.parse(req.body);
    const { rows } = await pool.query<CareerRow>(
      `INSERT INTO careers (company, department, position, employment_type, start_date, end_date,
         duties, achievements)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${columns}`,
      [
        input.company,
        input.department,
        input.position,
        input.employmentType,
        input.startDate,
        input.endDate,
        input.duties,
        input.achievements,
      ],
    );
    res.status(201).json({ career: toCareer(rows[0]) });
  });

  app.put('/api/careers/:id', async (req, res) => {
    const id = parseId(req.params.id, '이력');
    const input = careerInput.parse(req.body);
    const { rows } = await pool.query<CareerRow>(
      `UPDATE careers
       SET company = $2, department = $3, position = $4, employment_type = $5, start_date = $6,
           end_date = $7, duties = $8, achievements = $9, updated_at = now()
       WHERE id = $1
       RETURNING ${columns}`,
      [
        id,
        input.company,
        input.department,
        input.position,
        input.employmentType,
        input.startDate,
        input.endDate,
        input.duties,
        input.achievements,
      ],
    );
    if (rows.length === 0) throw notFoundError();
    res.json({ career: toCareer(rows[0]) });
  });

  app.delete('/api/careers/:id', async (req, res) => {
    const id = parseId(req.params.id, '이력');
    const { rowCount } = await pool.query('DELETE FROM careers WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
