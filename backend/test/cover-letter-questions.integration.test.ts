import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockApplications, testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

type Question = { id: number; question: string; answer: string | null; charLimit: number | null };

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'questions are saved per application as one list, in one transaction',
  { skip: !url },
  async (t) => {
    await lockApplications(t);
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM applications');

    await withApi(pool, async (call) => {
      const addApplication = async (companyName: string) => {
        const response = await call('/api/applications', {
          method: 'POST',
          body: { companyName, status: 'drafting' },
        });
        assert.equal(response.status, 201);
        return (response.data.application as { id: number }).id;
      };
      const first = await addApplication('한국소프트');
      const second = await addApplication('카카오');
      const path = (id: number) => `/api/applications/${String(id)}/questions`;
      const list = async (id: number) => {
        const response = await call(path(id));
        assert.equal(response.status, 200);
        return response.data.questions as Question[];
      };
      const save = (id: number, questions: unknown[]) =>
        call(path(id), { method: 'PUT', body: { questions } });

      assert.deepEqual(await list(first), []);

      // A blank answer and a missing limit are NULL. An answer over its limit is still stored.
      const created = await save(first, [
        { question: '  지원 동기  ', answer: ' ', charLimit: 500 },
        { question: '입사 후 포부', answer: '열 글자를 훌쩍 넘는 답변입니다', charLimit: 5 },
        { question: '성장 과정' },
      ]);
      assert.equal(created.status, 200);
      const [motive, plan, growth] = created.data.questions as Question[];
      assert.deepEqual(created.data.questions, [
        { id: motive.id, question: '지원 동기', answer: null, charLimit: 500 },
        {
          id: plan.id,
          question: '입사 후 포부',
          answer: '열 글자를 훌쩍 넘는 답변입니다',
          charLimit: 5,
        },
        { id: growth.id, question: '성장 과정', answer: null, charLimit: null },
      ]);

      // Another application's questions never show up in this one's list.
      const other = await save(second, [{ question: '협업 경험', answer: '스터디 운영' }]);
      assert.equal(other.status, 200);
      const [teamwork] = other.data.questions as Question[];
      assert.deepEqual(
        (await list(first)).map((row) => row.id),
        [motive.id, plan.id, growth.id],
      );
      assert.deepEqual(await list(second), [teamwork]);

      // One save moves the last question to the top (two questions swap places, which the
      // order constraint allows at commit), edits it, drops one and adds one.
      const reordered = await save(first, [
        { ...growth, answer: '시골에서 자랐습니다' },
        { ...motive },
        { question: '마지막 한마디', charLimit: 300 },
      ]);
      assert.equal(reordered.status, 200);
      const current = reordered.data.questions as Question[];
      assert.deepEqual(current.slice(0, 2), [{ ...growth, answer: '시골에서 자랐습니다' }, motive]);
      assert.equal(current.length, 3);
      assert.ok(![motive.id, plan.id, growth.id].includes(current[2].id));
      assert.deepEqual(await list(first), current);

      // Saving the same list again touches no row, NULL answers included.
      const stamps = async () =>
        (
          await pool.query<{ updated: string }>(
            `SELECT updated_at::text AS updated FROM cover_letter_questions
             WHERE application_id = $1 ORDER BY id`,
            [first],
          )
        ).rows.map((row) => row.updated);
      const before = await stamps();
      assert.equal((await save(first, current)).status, 200);
      assert.deepEqual(await stamps(), before);

      // A question the database refuses (NUL is valid JSON but not PostgreSQL text) rolls back
      // the whole save, including the edits and deletions before it.
      const nul = await save(first, [
        { ...current[0], answer: '바뀌면 안 됨' },
        { question: '새 문항', answer: '바뀌면\u0000안 됨' },
      ]);
      assert.equal(nul.status, 400);
      assert.equal(nul.data.error, '입력에 사용할 수 없는 문자(NUL)가 있습니다');
      assert.deepEqual(await list(first), current);

      // Another application's question cannot be pulled into this list.
      const foreign = await save(first, [...current, teamwork]);
      assert.equal(foreign.status, 409);
      assert.equal(
        foreign.data.error,
        '이 지원 기업에 없는 문항이 있습니다. 목록을 다시 불러와 주세요',
      );
      assert.deepEqual(await list(first), current);
      assert.deepEqual(await list(second), [teamwork]);

      // One question can be deleted on its own, but only through its own application.
      const wrongOwner = await call(`${path(first)}/${String(teamwork.id)}`, { method: 'DELETE' });
      assert.equal(wrongOwner.status, 404);
      assert.equal(wrongOwner.data.error, '자기소개서 문항을 찾을 수 없습니다');
      const removed = await call(`${path(first)}/${String(motive.id)}`, { method: 'DELETE' });
      assert.equal(removed.status, 204);
      assert.deepEqual(await list(first), [current[0], current[2]]);
      const again = await call(`${path(first)}/${String(motive.id)}`, { method: 'DELETE' });
      assert.equal(again.status, 404);

      // Deleting the application deletes its questions with it.
      assert.equal(
        (await call(`/api/applications/${String(first)}`, { method: 'DELETE' })).status,
        204,
      );
      const left = await pool.query(
        'SELECT 1 FROM cover_letter_questions WHERE application_id = $1',
        [first],
      );
      assert.equal(left.rowCount, 0);
      assert.deepEqual(await list(second), [teamwork]);

      for (const response of [await call(path(first)), await save(first, [])]) {
        assert.equal(response.status, 404);
        assert.equal(response.data.error, '지원 기업을 찾을 수 없습니다');
      }
    });
  },
);

// A list save holds the application row lock until it commits. A single delete must wait for it;
// otherwise it can remove a question between the save's check and its UPDATE, and the save returns
// 200 with that question's edits silently lost (1st review of PR #76).
test(
  'a single delete waits while a list save of the same application holds it',
  { skip: !url },
  async (t) => {
    await lockApplications(t);
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM applications');

    await withApi(pool, async (call) => {
      const created = await call('/api/applications', {
        method: 'POST',
        body: { companyName: '한국소프트', status: 'drafting' },
      });
      const path = `/api/applications/${String((created.data.application as { id: number }).id)}`;
      const saved = await call(`${path}/questions`, {
        method: 'PUT',
        body: { questions: [{ question: '지원 동기' }, { question: '입사 후 포부' }] },
      });
      const [, plan] = saved.data.questions as Question[];

      // Stands in for a list save that is still running: the same lock, not yet committed.
      const holder = await pool.connect();
      try {
        await holder.query('BEGIN');
        await holder.query('SELECT 1 FROM applications WHERE id = $1 FOR UPDATE', [
          (created.data.application as { id: number }).id,
        ]);
        let settled = false;
        const deleting = call(`${path}/questions/${String(plan.id)}`, { method: 'DELETE' }).then(
          (response) => {
            settled = true;
            return response;
          },
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        assert.equal(settled, false, 'the delete must wait for the save to finish');
        await holder.query('COMMIT');
        assert.equal((await deleting).status, 204);
      } finally {
        // After a failed assertion the lock is still held; this ends it (after COMMIT it is a no-op).
        await holder.query('ROLLBACK');
        holder.release();
      }
    });
  },
);

test('the database itself refuses rows the API would refuse', { skip: !url }, async (t) => {
  await lockApplications(t);
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM applications');
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO applications (company_name, status) VALUES ('한국소프트', 'drafting')
     RETURNING id::text AS id`,
  );
  const applicationId = rows[0].id;
  const insert = (question: string, charLimit: number | null, order: number) =>
    pool.query(
      `INSERT INTO cover_letter_questions (application_id, question, char_limit, display_order)
       VALUES ($1, $2, $3, $4)`,
      [applicationId, question, charLimit, order],
    );
  await assert.rejects(insert('', null, 0), /cover_letter_questions_question_check/);
  await assert.rejects(insert('지원 동기', 0, 0), /cover_letter_questions_char_limit_check/);
  await assert.rejects(insert('지원 동기', 5001, 0), /cover_letter_questions_char_limit_check/);
  await assert.rejects(insert('지원 동기', null, -1), /cover_letter_questions_display_order_check/);
  await insert('지원 동기', 5000, 0);
  await assert.rejects(insert('입사 후 포부', null, 0), /cover_letter_questions_order/);
});
