import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { objectBodyError, optionalText, requiredText } from './shared.js';

// Ten questions of 5000 Korean characters stay under the 256kb JSON body limit (issue #37).
const maxQuestions = 10;
const maxAnswer = 5000;

const charLimitError = `Character limit must be a whole number from 1 to ${String(maxAnswer)}`;
const questionIdError = 'Invalid question ID';

const questionInput = z.object(
  {
    // A question that is already saved keeps its id; a new one has none. Up to 15 digits, the same
    // range parseId accepts in a path.
    id: z
      .int({ error: questionIdError })
      .min(1, questionIdError)
      .max(999_999_999_999_999, questionIdError)
      .optional(),
    question: requiredText('Question', 500),
    // An answer longer than charLimit is still stored: the screen warns instead (issue #37).
    answer: optionalText('Answer', maxAnswer),
    charLimit: z
      .int({ error: charLimitError })
      .min(1, charLimitError)
      .max(maxAnswer, charLimitError)
      .nullable()
      .default(null),
  },
  { error: 'Question must be an object' },
);

const questionsInput = z.object(
  {
    // The list order is the display order, so there is no separate order field.
    questions: z
      .array(questionInput, { error: 'Send the question list (questions) as an array' })
      .max(maxQuestions, `Questions can have at most ${String(maxQuestions)} items`)
      .refine((questions) => {
        const ids = questions.flatMap((item) => (item.id === undefined ? [] : [item.id]));
        return new Set(ids).size === ids.length;
      }, 'The same question appears twice'),
  },
  objectBodyError,
);

type QuestionsInput = z.infer<typeof questionsInput>;

// The field messages do not say which question they are about, so the position is added in front.
function parseQuestions(body: unknown): QuestionsInput {
  const result = questionsInput.safeParse(body);
  if (result.success) return result.data;
  throw new z.ZodError(
    result.error.issues.map((issue) => {
      const [field, index] = issue.path;
      return field === 'questions' && typeof index === 'number'
        ? { ...issue, message: `Question ${String(index + 1)}: ${issue.message}` }
        : issue;
    }),
  );
}

type QuestionRow = { id: string } & Record<string, unknown>;

// bigint arrives as a string from pg, so the API casts it to a JSON number here.
const columns = `id::text AS id, question, answer, char_limit AS "charLimit"`;

const toQuestion = (row: QuestionRow) => ({ ...row, id: Number(row.id) });

const applicationNotFound = () => new HttpError(404, 'Application not found');

async function listQuestions(db: Pool | PoolClient, applicationId: number) {
  const { rows } = await db.query<QuestionRow>(
    `SELECT ${columns} FROM cover_letter_questions
     WHERE application_id = $1 ORDER BY display_order`,
    [applicationId],
  );
  return rows.map(toQuestion);
}

// Every write to one application's questions takes this row lock first, so list saves and single
// deletes of the same application run one after another. Deleting the application waits for it too.
async function lockApplication(client: PoolClient, applicationId: number) {
  const found = await client.query('SELECT 1 FROM applications WHERE id = $1 FOR UPDATE', [
    applicationId,
  ]);
  if (found.rowCount === 0) throw applicationNotFound();
}

async function inTransaction<T>(pool: Pool, run: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  let broken = false;
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // A connection that cannot even roll back is closed instead of going back to the pool.
      broken = true;
    }
    throw error;
  } finally {
    client.release(broken);
  }
}

export function registerCoverLetterQuestionRoutes(app: Express, pool: Pool) {
  app.get('/api/applications/:id/questions', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const found = await pool.query('SELECT 1 FROM applications WHERE id = $1', [applicationId]);
    if (found.rowCount === 0) throw applicationNotFound();
    res.json({ questions: await listQuestions(pool, applicationId) });
  });

  // Saves the whole list at once: questions missing from it are deleted, ones with an id are
  // updated and ones without are added. Any failure leaves every question as it was.
  app.put('/api/applications/:id/questions', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const { questions } = parseQuestions(req.body);
    const saved = await inTransaction(pool, async (client) => {
      await lockApplication(client, applicationId);

      // FOR UPDATE as well: even a writer that skipped the application lock could not delete a
      // question between this read and the UPDATE below, which would silently drop its edits.
      const existing = await client.query<{ id: string }>(
        'SELECT id::text AS id FROM cover_letter_questions WHERE application_id = $1 FOR UPDATE',
        [applicationId],
      );
      const known = new Set(existing.rows.map((row) => Number(row.id)));
      const keptIds = questions.flatMap((item) => (item.id === undefined ? [] : [item.id]));
      // Another application's question, or one deleted in another tab since the list was loaded.
      if (keptIds.some((id) => !known.has(id))) {
        throw new HttpError(
          409,
          'Some questions do not belong to this application. Please reload the list',
        );
      }

      await client.query(
        `DELETE FROM cover_letter_questions
         WHERE application_id = $1 AND NOT (id = ANY($2::bigint[]))`,
        [applicationId, keptIds],
      );
      for (const [order, item] of questions.entries()) {
        if (item.id === undefined) {
          await client.query(
            `INSERT INTO cover_letter_questions
               (application_id, question, answer, char_limit, display_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [applicationId, item.question, item.answer, item.charLimit, order],
          );
        } else {
          // Only a question that really changed gets a new updated_at.
          await client.query(
            `UPDATE cover_letter_questions
             SET question = $3, answer = $4, char_limit = $5, display_order = $6, updated_at = now()
             WHERE id = $1 AND application_id = $2
               AND (question, answer, char_limit, display_order)
                   IS DISTINCT FROM ($3, $4, $5::integer, $6::integer)`,
            [item.id, applicationId, item.question, item.answer, item.charLimit, order],
          );
        }
      }
      return listQuestions(client, applicationId);
    });
    res.json({ questions: saved });
  });

  app.delete('/api/applications/:id/questions/:questionId', async (req, res) => {
    const applicationId = parseId(req.params.id, 'application');
    const questionId = parseId(req.params.questionId, 'cover letter question');
    await inTransaction(pool, async (client) => {
      // Waits for a list save of the same application, so it never lands in the middle of one.
      await lockApplication(client, applicationId);
      // The order of the questions left keeps its gap, which still sorts the same way.
      const { rowCount } = await client.query(
        'DELETE FROM cover_letter_questions WHERE id = $1 AND application_id = $2',
        [questionId, applicationId],
      );
      if (rowCount === 0) throw new HttpError(404, 'Cover letter question not found');
    });
    res.status(204).end();
  });
}
