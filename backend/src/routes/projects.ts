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
      .string({ error: 'Technologies items must be text' })
      .trim()
      .min(1, 'Technologies items cannot be empty')
      .max(50, 'Technologies items must be at most 50 characters'),
    { error: 'Technologies must be a list' },
  )
  .max(30, 'Technologies can have at most 30 items')
  .default([])
  .refine(
    (names) => new Set(names.map((name) => name.toLowerCase())).size === names.length,
    'Technologies contain a duplicate item',
  );

// An empty end date means the project is still running, so there is no separate status field.
export const projectInput = z
  .object(
    {
      name: requiredText('Project name', 100),
      organization: optionalText('Organization', 100),
      // The career this project was done at (#224); null means none. The database checks that it exists.
      careerId: z
        .number({ error: 'Career must be a number' })
        .int('Career must be a whole number')
        .min(1, 'Career must be a positive number')
        .max(999_999_999_999_999, 'Career is too large')
        .nullable()
        .default(null),
      startDate: calendarDate('Start date'),
      endDate: calendarDate('End date').nullable().default(null),
      role: optionalText('Role', 100),
      summary: optionalText('Summary', 500),
      contributions: optionalText('Contributions', 2000),
      technologies,
      repositoryUrl: optionalLink('Repository link'),
      serviceUrl: optionalLink('Service link'),
    },
    objectBodyError,
  )
  .superRefine((input, ctx) => {
    if (input.endDate !== null && input.endDate < input.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date cannot be earlier than start date',
      });
    }
  });

type ProjectRow = { id: number } & Record<string, unknown>;

const columns = `id, name, organization, career_id AS "careerId", start_date AS "startDate", end_date AS "endDate",
  role, summary, contributions, technologies, repository_url AS "repositoryUrl",
  service_url AS "serviceUrl"`;

const notFoundError = () => new HttpError(404, 'Project not found');

/** A career id that matches no career breaks the foreign key: answer it as a bad input, not a 500. */
function careerLinkError(error: unknown) {
  const broken = (error as { code?: unknown }).code === '23503';
  return broken ? new HttpError(400, 'Career not found') : error;
}

/** The column values in the order of the INSERT; the UPDATE puts the id in front. */
const values = (input: z.output<typeof projectInput>) => [
  input.name,
  input.organization,
  input.careerId,
  input.startDate,
  input.endDate,
  input.role,
  input.summary,
  input.contributions,
  input.technologies,
  input.repositoryUrl,
  input.serviceUrl,
];

export function registerProjectRoutes(app: Express, pool: Pool) {
  app.get('/api/projects', async (_req, res) => {
    const { rows } = await pool.query<ProjectRow>(
      `SELECT ${columns} FROM projects ORDER BY start_date DESC, projects.id DESC`,
    );
    res.json({ projects: rows });
  });

  app.post('/api/projects', async (req, res) => {
    const input = projectInput.parse(req.body);
    const { rows } = await pool
      .query<ProjectRow>(
        `INSERT INTO projects (name, organization, career_id, start_date, end_date, role, summary,
           contributions, technologies, repository_url, service_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING ${columns}`,
        values(input),
      )
      .catch((error: unknown) => {
        throw careerLinkError(error);
      });
    res.status(201).json({ project: rows[0] });
  });

  app.put('/api/projects/:id', async (req, res) => {
    const id = parseId(req.params.id, 'project');
    const input = projectInput.parse(req.body);
    const { rows } = await pool
      .query<ProjectRow>(
        `UPDATE projects
         SET name = $2, organization = $3, career_id = $4, start_date = $5, end_date = $6, role = $7,
             summary = $8, contributions = $9, technologies = $10, repository_url = $11,
             service_url = $12, updated_at = now()
         WHERE id = $1
         RETURNING ${columns}`,
        [id, ...values(input)],
      )
      .catch((error: unknown) => {
        throw careerLinkError(error);
      });
    if (rows.length === 0) throw notFoundError();
    res.json({ project: rows[0] });
  });

  app.delete('/api/projects/:id', async (req, res) => {
    const id = parseId(req.params.id, 'project');
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
