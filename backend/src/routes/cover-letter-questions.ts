import type { Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod/v4';

import { withTransaction } from '../standard/db.js';
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

export const questionsInput = z.object(
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

// Search for earlier answers (#231): text to find, and the application being edited, which is left out.
const searchInput = z.object({
  q: z
    .string({ error: 'Search text is required' })
    .trim()
    .min(1, 'Search text is required')
    .max(100, 'Search text must be at most 100 characters'),
  exclude: z
    .string()
    .regex(/^[1-9]\d{0,14}$/, 'Invalid application ID')
    .optional(),
});

/** `%`, `_` and `\` are plain text in a search, not LIKE wildcards. */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, '\\$&');

const maxMatches = 20;

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

type QuestionRow = { id: number } & Record<string, unknown>;

const columns = `id, question, answer, char_limit AS "charLimit"`;

const applicationNotFound = () => new HttpError(404, 'Application not found');

async function listQuestions(db: Pool | PoolClient, applicationId: number) {
  const { rows } = await db.query<QuestionRow>(
    `SELECT ${columns} FROM cover_letter_questions
     WHERE application_id = $1 ORDER BY display_order`,
    [applicationId],
  );
  return rows;
}

// Every write to one application's questions takes this row lock first, so list saves and single
// deletes of the same application run one after another. Deleting the application waits for it too.
async function lockApplication(client: PoolClient, applicationId: number) {
  const found = await client.query('SELECT 1 FROM applications WHERE id = $1 FOR UPDATE', [
    applicationId,
  ]);
  if (found.rowCount === 0) throw applicationNotFound();
}

const inTransaction = <T>(pool: Pool, run: (client: PoolClient) => Promise<T>) =>
  withTransaction<T, PoolClient>(pool, run);

export function registerCoverLetterQuestionRoutes(app: Express, pool: Pool) {
  // Earlier questions and answers whose question or answer contains the text, newest application
  // first. Questions without an answer have nothing to reuse and are skipped.
  app.get('/api/cover-letter-answers', async (req, res) => {
    const { q, exclude } = searchInput.parse(req.query);
    const { rows } = await pool.query(
      `SELECT cq.id, cq.question, cq.answer, cq.char_limit AS "charLimit",
              a.id AS "applicationId", a.company_name AS "companyName", a.position,
              to_char(a.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD') AS date
       FROM cover_letter_questions cq
       JOIN applications a ON a.id = cq.application_id
       WHERE cq.answer IS NOT NULL
         AND (cq.question ILIKE $1 OR cq.answer ILIKE $1)
         AND ($2::bigint IS NULL OR a.id <> $2::bigint)
       ORDER BY a.created_at DESC, a.id DESC, cq.display_order
       LIMIT $3`,
      [`%${escapeLike(q)}%`, exclude ?? null, maxMatches],
    );
    res.json({ matches: rows });
  });

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
      const existing = await client.query<{ id: number }>(
        'SELECT id FROM cover_letter_questions WHERE application_id = $1 FOR UPDATE',
        [applicationId],
      );
      const known = new Set(existing.rows.map((row) => row.id));
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
