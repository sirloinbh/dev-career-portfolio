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
const projectInput = z
  .object(
    {
      name: requiredText('Project name', 100),
      organization: optionalText('Organization', 100),
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

type ProjectRow = { id: string } & Record<string, unknown>;

// bigint arrives as a string from pg, so the API casts it to a JSON number here.
const columns = `id::text AS id, name, organization, start_date AS "startDate", end_date AS "endDate",
  role, summary, contributions, technologies, repository_url AS "repositoryUrl",
  service_url AS "serviceUrl"`;

const toProject = (row: ProjectRow) => ({ ...row, id: Number(row.id) });

const notFoundError = () => new HttpError(404, 'Project not found');

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
    const id = parseId(req.params.id, 'project');
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
    const id = parseId(req.params.id, 'project');
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
