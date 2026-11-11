import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { objectBodyError, optionalText, requiredText } from './shared.js';

// The list shows the categories in this order (issue #34).
const categories = [
  'language',
  'framework',
  'database',
  'infrastructure',
  'tool',
  'other',
] as const;

const proficiencyError = 'Proficiency must be a whole number from 1 to 5';

const skillInput = z.object(
  {
    name: requiredText('Skill name', 50),
    category: z.enum(categories, {
      error: 'Category must be one of language, framework, database, infrastructure, tool, other',
    }),
    // A JSON number only: "3" is refused rather than converted, like every other field. One check,
    // not .int().min().max(): past the safe integer range those each fail and repeat the message.
    proficiency: z
      .number({ error: proficiencyError })
      .refine((value) => Number.isInteger(value) && value >= 1 && value <= 5, proficiencyError),
    memo: optionalText('Notes', 2000),
  },
  objectBodyError,
);

type SkillRow = { id: string } & Record<string, unknown>;

// bigint arrives as a string from pg, so the API casts it to a JSON number here.
const columns = 'id::text AS id, name, category, proficiency, memo';

const toSkill = (row: SkillRow) => ({ ...row, id: Number(row.id) });

const notFoundError = () => new HttpError(404, 'Skill not found');

/** The unique index on lower(name) refused the row: the name is taken, whatever its case. */
async function refuseDuplicateName<T>(query: Promise<T>) {
  try {
    return await query;
  } catch (error) {
    const { code, constraint } = error as { code?: unknown; constraint?: unknown };
    if (code === '23505' && constraint === 'skills_name_unique') {
      throw new HttpError(409, 'This skill is already registered');
    }
    throw error;
  }
}

export function registerSkillRoutes(app: Express, pool: Pool) {
  app.get('/api/skills', async (_req, res) => {
    // Category in the fixed order above, then the strongest first, then the name. COLLATE "C" keeps
    // the name order the same on every database locale: Latin letters first, then Korean alphabetical order.
    const { rows } = await pool.query<SkillRow>(
      `SELECT ${columns} FROM skills
       ORDER BY array_position($1::text[], category), proficiency DESC, lower(name) COLLATE "C"`,
      [categories],
    );
    res.json({ skills: rows.map(toSkill) });
  });

  app.post('/api/skills', async (req, res) => {
    const input = skillInput.parse(req.body);
    const { rows } = await refuseDuplicateName(
      pool.query<SkillRow>(
        `INSERT INTO skills (name, category, proficiency, memo)
         VALUES ($1, $2, $3, $4)
         RETURNING ${columns}`,
        [input.name, input.category, input.proficiency, input.memo],
      ),
    );
    res.status(201).json({ skill: toSkill(rows[0]) });
  });

  app.put('/api/skills/:id', async (req, res) => {
    const id = parseId(req.params.id, 'skill');
    const input = skillInput.parse(req.body);
    const { rows } = await refuseDuplicateName(
      pool.query<SkillRow>(
        `UPDATE skills
         SET name = $2, category = $3, proficiency = $4, memo = $5, updated_at = now()
         WHERE id = $1
         RETURNING ${columns}`,
        [id, input.name, input.category, input.proficiency, input.memo],
      ),
    );
    if (rows.length === 0) throw notFoundError();
    res.json({ skill: toSkill(rows[0]) });
  });

  app.delete('/api/skills/:id', async (req, res) => {
    const id = parseId(req.params.id, 'skill');
    const { rowCount } = await pool.query('DELETE FROM skills WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
