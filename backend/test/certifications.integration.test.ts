import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

type Certification = {
  id: number;
  name: string;
  issuer: string;
  acquiredDate: string;
  expiryDate: string | null;
  score: string | null;
  memo: string | null;
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'certifications are stored, listed newest first, updated and deleted',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM certifications');

    await withApi(pool, async (call) => {
      const add = async (body: Record<string, unknown>) => {
        const response = await call('/api/certifications', { method: 'POST', body });
        assert.equal(response.status, 201);
        return response.data.certification as Certification;
      };

      // No expiry: stored as NULL, not as a placeholder date. Spaces go, blank text is NULL.
      const engineer = await add({
        name: '  정보처리기사  ',
        issuer: ' 한국산업인력공단 ',
        acquiredDate: '2021-06-09',
        score: '  ',
        memo: '',
      });
      assert.deepEqual(engineer, {
        id: engineer.id,
        name: '정보처리기사',
        issuer: '한국산업인력공단',
        acquiredDate: '2021-06-09',
        expiryDate: null,
        score: null,
        memo: null,
      });
      const stored = await pool.query<{ expiry_date: unknown }>(
        'SELECT expiry_date FROM certifications WHERE id = $1',
        [engineer.id],
      );
      assert.equal(stored.rows[0].expiry_date, null);

      // Acquired 2024, 2019, then 2024 again, so neither id order matches the expected list.
      // The same exam twice is allowed: each sitting is its own row, even an identical one.
      const toeic = await add({
        name: 'TOEIC',
        issuer: 'YBM',
        acquiredDate: '2024-03-10',
        expiryDate: '2026-03-10',
        score: '905점',
      });
      const older = { name: 'TOEIC', issuer: 'YBM', acquiredDate: '2019-01-20', score: '780점' };
      await add(older);
      await add(older);
      // Expires the day it was acquired: allowed. Already expired: still stored.
      const sameDay = await add({
        name: 'OPIc',
        issuer: 'ACTFL',
        acquiredDate: '2024-03-10',
        expiryDate: '2024-03-10',
        score: 'IH',
        memo: '말하기 시험',
      });
      assert.equal(sameDay.expiryDate, '2024-03-10');

      const list = await call('/api/certifications');
      assert.equal(list.status, 200);
      const rows = list.data.certifications as Certification[];
      // Newest acquisition first; on the same day the one added last comes first.
      assert.deepEqual(
        rows.map((row) => [row.name, row.acquiredDate, row.score]),
        [
          ['OPIc', '2024-03-10', 'IH'],
          ['TOEIC', '2024-03-10', '905점'],
          ['정보처리기사', '2021-06-09', null],
          ['TOEIC', '2019-01-20', '780점'],
          ['TOEIC', '2019-01-20', '780점'],
        ],
      );

      // Every column changes, and clearing the expiry stores NULL again.
      const updated = await call(`/api/certifications/${String(toeic.id)}`, {
        method: 'PUT',
        body: {
          name: 'TOEIC Speaking',
          issuer: 'ETS',
          acquiredDate: '2024-04-01',
          expiryDate: null,
          score: 'Level 7',
          memo: '재응시',
        },
      });
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.data.certification, {
        id: toeic.id,
        name: 'TOEIC Speaking',
        issuer: 'ETS',
        acquiredDate: '2024-04-01',
        expiryDate: null,
        score: 'Level 7',
        memo: '재응시',
      });

      const refused = await call(`/api/certifications/${String(sameDay.id)}`, {
        method: 'PUT',
        body: {
          name: 'OPIc',
          issuer: 'ACTFL',
          acquiredDate: '2024-03-10',
          expiryDate: '2024-03-09',
        },
      });
      assert.equal(refused.status, 400);
      assert.equal(refused.data.error, '만료일은 취득일보다 빠를 수 없습니다');

      // An update the database itself refuses (NUL is valid JSON but not PostgreSQL text) is a
      // 400 and leaves the row as it was.
      const nul = await call(`/api/certifications/${String(sameDay.id)}`, {
        method: 'PUT',
        body: {
          name: 'OPIc',
          issuer: 'ACTFL',
          acquiredDate: '2025-01-01',
          memo: '바뀌면\u0000안 됨',
        },
      });
      assert.equal(nul.status, 400);
      assert.equal(nul.data.error, '입력에 사용할 수 없는 문자(NUL)가 있습니다');
      const kept = await call('/api/certifications');
      assert.deepEqual(
        (kept.data.certifications as Certification[]).find((row) => row.id === sameDay.id),
        sameDay,
      );

      const removed = await call(`/api/certifications/${String(toeic.id)}`, { method: 'DELETE' });
      assert.equal(removed.status, 204);
      const after = await call('/api/certifications');
      const ids = (after.data.certifications as Certification[]).map((row) => row.id);
      assert.equal(ids.length, 4);
      assert.ok(!ids.includes(toeic.id));

      for (const request of [
        {
          method: 'PUT',
          body: { name: 'SQLD', issuer: '한국데이터산업진흥원', acquiredDate: '2022-01-01' },
        },
        { method: 'DELETE' },
      ]) {
        const missing = await call(`/api/certifications/${String(toeic.id)}`, request);
        assert.equal(missing.status, 404);
        assert.equal(missing.data.error, '자격증을 찾을 수 없습니다');
      }
    });
  },
);

test('the database itself refuses rows the API would refuse', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM certifications');
  const insert = (name: string, issuer: string, acquired: string, expiry: string | null) =>
    pool.query(
      'INSERT INTO certifications (name, issuer, acquired_date, expiry_date) VALUES ($1, $2, $3, $4)',
      [name, issuer, acquired, expiry],
    );
  await assert.rejects(insert('', 'YBM', '2024-01-01', null), /certifications_name_check/);
  await assert.rejects(insert('TOEIC', '', '2024-01-01', null), /certifications_issuer_check/);
  await assert.rejects(insert('TOEIC', 'YBM', '2024-01-01', '2023-12-31'), /certifications_period/);
  await insert('TOEIC', 'YBM', '2024-01-01', '2024-01-01');
  await insert('TOEIC', 'YBM', '2024-01-01', null);
});
