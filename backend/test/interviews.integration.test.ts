import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockApplications, testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

type Interview = {
  id: number;
  round: number;
  date: string;
  time: string;
  format: string;
  questions: string | null;
  retrospective: string | null;
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'interviews are kept per application, in time order, and go with it',
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
          body: { companyName, status: 'first_interview' },
        });
        assert.equal(response.status, 201);
        return (response.data.application as { id: number }).id;
      };
      const first = await addApplication('한국소프트');
      const second = await addApplication('카카오');
      const path = (id: number, interviewId?: number) =>
        `/api/applications/${String(id)}/interviews${interviewId === undefined ? '' : `/${String(interviewId)}`}`;
      const list = async (id: number) => {
        const response = await call(path(id));
        assert.equal(response.status, 200);
        return response.data.interviews as Interview[];
      };

      assert.deepEqual(await list(first), []);

      // The day and time come back as they were sent (Asia/Seoul), also at midnight and just before it.
      const later = await call(path(first), {
        method: 'POST',
        body: {
          round: 2,
          date: '2026-12-10',
          time: '00:00',
          format: 'onsite',
          questions: ' 시스템 설계 ',
        },
      });
      assert.equal(later.status, 201);
      const earlier = await call(path(first), {
        method: 'POST',
        body: { round: 1, date: '2026-12-03', time: '23:59', format: 'phone', retrospective: ' ' },
      });
      assert.equal(earlier.status, 201);
      const secondRound = later.data.interview as Interview;
      const firstRound = earlier.data.interview as Interview;
      assert.deepEqual(secondRound, {
        id: secondRound.id,
        round: 2,
        date: '2026-12-10',
        time: '00:00',
        format: 'onsite',
        questions: '시스템 설계',
        retrospective: null,
      });
      assert.deepEqual(firstRound, {
        id: firstRound.id,
        round: 1,
        date: '2026-12-03',
        time: '23:59',
        format: 'phone',
        questions: null,
        retrospective: null,
      });

      // Listed by date, whichever was added first; another application's list stays apart.
      assert.deepEqual(await list(first), [firstRound, secondRound]);
      assert.deepEqual(await list(second), []);

      // Update replaces every field and keeps the row.
      const updated = await call(path(first, firstRound.id), {
        method: 'PUT',
        body: {
          round: 1,
          date: '2026-12-12',
          time: '09:05',
          format: 'video',
          questions: '자기소개',
          retrospective: '긴장해서 답이 길어졌다',
        },
      });
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.data.interview, {
        id: firstRound.id,
        round: 1,
        date: '2026-12-12',
        time: '09:05',
        format: 'video',
        questions: '자기소개',
        retrospective: '긴장해서 답이 길어졌다',
      });
      assert.deepEqual(
        (await list(first)).map((row) => row.id),
        [secondRound.id, firstRound.id],
      );

      // An interview is reached only through its own application.
      const wrongOwner = await call(path(second, firstRound.id), {
        method: 'PUT',
        body: { round: 1, date: '2026-12-12', time: '09:05', format: 'video' },
      });
      assert.equal(wrongOwner.status, 404);
      assert.equal(wrongOwner.data.error, 'Interview not found');
      assert.equal((await call(path(second, firstRound.id), { method: 'DELETE' })).status, 404);
      assert.equal((await list(first)).length, 2);

      // A missing application is a 404 for the list and for adding.
      const missing = await call(path(999_999));
      assert.equal(missing.status, 404);
      assert.equal(missing.data.error, 'Application not found');
      const addToMissing = await call(path(999_999), {
        method: 'POST',
        body: { round: 1, date: '2026-12-12', time: '09:05', format: 'video' },
      });
      assert.equal(addToMissing.status, 404);

      // A NUL character is valid JSON but not PostgreSQL text: the write is refused and nothing changes.
      const nul = await call(path(first), {
        method: 'POST',
        body: {
          round: 3,
          date: '2026-12-20',
          time: '10:00',
          format: 'video',
          questions: 'a\u0000b',
        },
      });
      assert.equal(nul.status, 400);
      assert.equal((await list(first)).length, 2);

      const removed = await call(path(first, secondRound.id), { method: 'DELETE' });
      assert.equal(removed.status, 204);
      assert.equal((await call(path(first, secondRound.id), { method: 'DELETE' })).status, 404);
      assert.deepEqual(
        (await list(first)).map((row) => row.id),
        [firstRound.id],
      );

      // Deleting the application deletes its interviews with it.
      assert.equal(
        (await call(`/api/applications/${String(first)}`, { method: 'DELETE' })).status,
        204,
      );
      const left = await pool.query('SELECT 1 FROM interviews WHERE application_id = $1', [first]);
      assert.equal(left.rowCount, 0);
    });
  },
);
