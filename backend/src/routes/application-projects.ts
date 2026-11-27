import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { withTransaction } from '../standard/db.js';
import { HttpError, parseId } from '../standard/http.js';
import { objectBodyError } from './shared.js';

// The projects an application highlights (#234): a list of project ids kept per application, read and replaced as a
// whole. The resume screen starts from it.
const idsError = 'Project ids must be a list of project ids';

export const applicationProjectsInput = z.object(
  {
    projectIds: z
      .array(
        z
          .number({ error: idsError })
          .int(idsError)
          .min(1, idsError)
          .max(999_999_999_999_999, idsError),
        { error: idsError },
      )
      .max(50, 'At most 50 projects can be highlighted'),
  },
  objectBodyError,
);

const applicationNotFound = () => new HttpError(404, 'Application not found');

async function readIds(db: Pool | PoolClient, applicationId: number) {
  const { rows } = await db.query<{ project_id: string }>(
    `SELECT ap.project_id FROM application_projects ap
     JOIN projects p ON p.id = ap.project_id
     WHERE ap.application_id = $1
     ORDER BY p.start_date DESC, p.id DESC`,
    [applicationId],
  );
  // bigint comes back as text; ids fit a JS number (the input limit is below 2^53).
  return rows.map((row) => Number(row.project_id));
}

/** A project or application that matches nothing breaks a foreign key: answer it as the input error it is, not a 500. */
function linkError(error: unknown) {
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  if (code !== '23503') return error;
  return constraint === 'application_projects_application_id_fkey'
    ? applicationNotFound()
    : new HttpError(400, 'Project not found');
}

export function registerApplicationProjectRoutes(app: Express, pool: Pool) {
  app.get('/api/applications/:id/projects', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const found = await pool.query('SELECT 1 FROM applications WHERE id = $1', [applicationId]);
    if (found.rowCount === 0) throw applicationNotFound();
    res.json({ projectIds: await readIds(pool, applicationId) });
  });

  app.put('/api/applications/:id/projects', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const { projectIds } = applicationProjectsInput.parse(req.body);
    const ids = [...new Set(projectIds)];
    const saved = await withTransaction<number[], PoolClient>(pool, async (client) => {
      const found = await client.query('SELECT 1 FROM applications WHERE id = $1', [applicationId]);
      if (found.rowCount === 0) throw applicationNotFound();
      await client.query('DELETE FROM application_projects WHERE application_id = $1', [
        applicationId,
      ]);
      if (ids.length > 0) {
        await client.query(
          'INSERT INTO application_projects (application_id, project_id) SELECT $1, unnest($2::bigint[])',
          [applicationId, ids],
        );
      }
      return readIds(client, applicationId);
    }).catch((error: unknown) => {
      throw linkError(error);
    });
    res.json({ projectIds: saved });
  });
}
