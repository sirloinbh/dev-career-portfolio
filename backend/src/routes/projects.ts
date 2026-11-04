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

// Technology names stay a plain list for now (issue #33), not linked to the skills table.
const technologies = z
  .array(
    z
      .string({ error: '사용 기술 항목은 문자열이어야 합니다' })
      .trim()
      .min(1, '사용 기술 항목을 비울 수 없습니다')
      .max(50, '사용 기술 항목은 50자 이하여야 합니다'),
    { error: '사용 기술은(는) 목록이어야 합니다' },
  )
  .max(30, '사용 기술은 30개까지 입력할 수 있습니다')
  .default([])
  .refine(
    (names) => new Set(names.map((name) => name.toLowerCase())).size === names.length,
    '사용 기술에 중복된 항목이 있습니다',
  );

// An empty end date means the project is still running, so there is no separate status field.
const projectInput = z
  .object(
    {
      name: requiredText('프로젝트명', 100),
      organization: optionalText('소속', 100),
      startDate: calendarDate('시작일'),
      endDate: calendarDate('종료일').nullable().default(null),
      role: optionalText('역할', 100),
      summary: optionalText('요약', 500),
      contributions: optionalText('기여와 성과', 2000),
      technologies,
      repositoryUrl: optionalLink('저장소 링크'),
      serviceUrl: optionalLink('서비스 링크'),
    },
    objectBodyError,
  )
  .superRefine((input, ctx) => {
    if (input.endDate !== null && input.endDate < input.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: '종료일은 시작일보다 빠를 수 없습니다',
      });
    }
  });

type ProjectRow = { id: string } & Record<string, unknown>;

// bigint arrives as a string from pg, so the API casts it to a JSON number here.
const columns = `id::text AS id, name, organization, start_date AS "startDate", end_date AS "endDate",
  role, summary, contributions, technologies, repository_url AS "repositoryUrl",
  service_url AS "serviceUrl"`;

const toProject = (row: ProjectRow) => ({ ...row, id: Number(row.id) });

const notFoundError = () => new HttpError(404, '프로젝트를 찾을 수 없습니다');

export function registerProjectRoutes(app: Express, pool: Pool) {
  app.get('/api/projects', async (_req, res) => {
    const { rows } = await pool.query<ProjectRow>(
      // projects.id, not id: a bare name would pick the text output column and sort "10" before "9".
      `SELECT ${columns} FROM projects ORDER BY start_date DESC, projects.id DESC`,
    );
    res.json({ projects: rows.map(toProject) });
  });

  app.post('/api/projects', async (req, res) => {
    const input = projectInput.parse(req.body);
    const { rows } = await pool.query<ProjectRow>(
      `INSERT INTO projects (name, organization, start_date, end_date, role, summary, contributions,
         technologies, repository_url, service_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${columns}`,
      [
        input.name,
        input.organization,
        input.startDate,
        input.endDate,
        input.role,
        input.summary,
        input.contributions,
        input.technologies,
        input.repositoryUrl,
        input.serviceUrl,
      ],
    );
    res.status(201).json({ project: toProject(rows[0]) });
  });

  app.put('/api/projects/:id', async (req, res) => {
    const id = parseId(req.params.id, '프로젝트');
    const input = projectInput.parse(req.body);
    const { rows } = await pool.query<ProjectRow>(
      `UPDATE projects
       SET name = $2, organization = $3, start_date = $4, end_date = $5, role = $6, summary = $7,
           contributions = $8, technologies = $9, repository_url = $10, service_url = $11,
           updated_at = now()
       WHERE id = $1
       RETURNING ${columns}`,
      [
        id,
        input.name,
        input.organization,
        input.startDate,
        input.endDate,
        input.role,
        input.summary,
        input.contributions,
        input.technologies,
        input.repositoryUrl,
        input.serviceUrl,
      ],
    );
    if (rows.length === 0) throw notFoundError();
    res.json({ project: toProject(rows[0]) });
  });

  app.delete('/api/projects/:id', async (req, res) => {
    const id = parseId(req.params.id, '프로젝트');
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
