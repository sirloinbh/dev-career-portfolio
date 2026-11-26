import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { withTransaction } from '../standard/db.js';
import { HttpError, parseId } from '../standard/http.js';
import {
  calendarDate,
  objectBodyError,
  optionalLink,
  optionalText,
  requiredText,
} from './shared.js';

// The skills a project used, as ids from the skills table (#225). The database checks that each one exists.
const skillIds = z
  .array(
    z
      .number({ error: 'Skills must be a list of skill ids' })
      .int('Skills must be a list of skill ids')
      .min(1, 'Skills must be a list of skill ids')
      .max(999_999_999_999_999, 'Skills must be a list of skill ids'),
    { error: 'Skills must be a list' },
  )
  .max(30, 'Skills can have at most 30 items')
  .default([])
  .refine((ids) => new Set(ids).size === ids.length, 'Skills contain a duplicate item');

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
      skillIds,
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
  role, summary, contributions, repository_url AS "repositoryUrl",
  service_url AS "serviceUrl",
  COALESCE((SELECT json_agg(ps.skill_id ORDER BY lower(s.name) COLLATE "C", s.id)
            FROM project_skills ps JOIN skills s ON s.id = ps.skill_id
            WHERE ps.project_id = projects.id), '[]'::json) AS "skillIds"`;

const notFoundError = () => new HttpError(404, 'Project not found');

/** A career or skill id that matches nothing breaks a foreign key: answer it as a bad input, not a 500. */
function linkError(error: unknown) {
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  if (code !== '23503') return error;
  return new HttpError(
    400,
    constraint === 'project_skills_skill_id_fkey' ? 'Skill not found' : 'Career not found',
  );
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
  input.repositoryUrl,
  input.serviceUrl,
];

/** Replaces the project's skill links with `ids`. */
async function saveSkills(client: PoolClient, projectId: number, ids: number[]) {
  await client.query('DELETE FROM project_skills WHERE project_id = $1', [projectId]);
  if (ids.length === 0) return;
  await client.query(
    'INSERT INTO project_skills (project_id, skill_id) SELECT $1, unnest($2::bigint[])',
    [projectId, ids],
  );
}

/** One project as the list shows it, with its skill ids. */
async function readProject(client: PoolClient, id: number) {
  const { rows } = await client.query<ProjectRow>(`SELECT ${columns} FROM projects WHERE id = $1`, [
    id,
  ]);
  return rows[0];
}

const inTransaction = <T>(pool: Pool, run: (client: PoolClient) => Promise<T>) =>
  withTransaction<T, PoolClient>(pool, run).catch((error: unknown) => {
    throw linkError(error);
  });

export function registerProjectRoutes(app: Express, pool: Pool) {
  app.get('/api/projects', async (_req, res) => {
    const { rows } = await pool.query<ProjectRow>(
      `SELECT ${columns} FROM projects ORDER BY start_date DESC, projects.id DESC`,
    );
    res.json({ projects: rows });
  });

  app.post('/api/projects', async (req, res) => {
    const input = projectInput.parse(req.body);
    const project = await inTransaction(pool, async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO projects (name, organization, career_id, start_date, end_date, role, summary,
           contributions, repository_url, service_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        values(input),
      );
      const id = rows[0].id;
      await saveSkills(client, id, input.skillIds);
      return readProject(client, id);
    });
    res.status(201).json({ project });
  });

  app.put('/api/projects/:id', async (req, res) => {
    const id = parseId(req.params.id, 'project');
    const input = projectInput.parse(req.body);
    const project = await inTransaction(pool, async (client) => {
      const { rowCount } = await client.query(
        `UPDATE projects
         SET name = $2, organization = $3, career_id = $4, start_date = $5, end_date = $6, role = $7,
             summary = $8, contributions = $9, repository_url = $10, service_url = $11,
             updated_at = now()
         WHERE id = $1`,
        [id, ...values(input)],
      );
      if (rowCount === 0) throw notFoundError();
      await saveSkills(client, id, input.skillIds);
      return readProject(client, id);
    });
    res.json({ project });
  });

  app.delete('/api/projects/:id', async (req, res) => {
    const id = parseId(req.params.id, 'project');
    const { rowCount } = await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
