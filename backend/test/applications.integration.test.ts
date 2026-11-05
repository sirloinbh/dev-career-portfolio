import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockApplications, testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

type Application = {
  id: number;
  companyName: string;
  position: string | null;
  postingUrl: string | null;
  deadline: string | null;
  status: string;
  memo: string | null;
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'applications are stored, listed by status and deadline, updated and deleted',
  { skip: !url },
  async (t) => {
    await lockApplications(t);
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM applications');

    await withApi(pool, async (call) => {
      const add = async (body: Record<string, unknown>) => {
        const response = await call('/api/applications', { method: 'POST', body });
        assert.equal(response.status, 201);
        return response.data.application as Application;
      };

      // Spaces go, blank optional text and a missing deadline are NULL, not a placeholder.
      const open = await add({
        companyName: '  한국소프트  ',
        position: ' ',
        postingUrl: '',
        status: 'drafting',
        memo: '',
      });
      assert.deepEqual(open, {
        id: open.id,
        companyName: '한국소프트',
        position: null,
        postingUrl: null,
        deadline: null,
        status: 'drafting',
        memo: null,
      });
      const stored = await pool.query<{ deadline: unknown }>(
        'SELECT deadline FROM applications WHERE id = $1',
        [open.id],
      );
      assert.equal(stored.rows[0].deadline, null);

      // Added out of order on purpose: neither id order nor insert order matches the list.
      // A deadline already past is still stored.
      const closed = await add({
        companyName: '종료회사',
        status: 'closed',
        deadline: '2025-01-10',
      });
      const lateSubmitted = await add({
        companyName: '제출회사',
        position: '프론트엔드',
        postingUrl: 'https://careers.example.com/jobs/12',
        deadline: '2026-03-01',
        status: 'submitted',
        memo: '1차 서류',
      });
      // Dates come back as the same YYYY-MM-DD text, the past one included.
      assert.equal(closed.deadline, '2025-01-10');
      assert.equal(lateSubmitted.deadline, '2026-03-01');
      assert.equal(lateSubmitted.postingUrl, 'https://careers.example.com/jobs/12');
      const farDraft = await add({
        companyName: '먼회사',
        status: 'drafting',
        deadline: '2026-12-01',
      });
      // The same company and position twice: each application is its own row.
      const twin = {
        companyName: '카카오',
        position: '백엔드',
        status: 'drafting',
        deadline: '2026-11-20',
      };
      const firstTwin = await add(twin);
      const earlySubmitted = await add({
        companyName: '제출회사',
        position: '백엔드',
        deadline: '2026-02-01',
        status: 'submitted',
      });
      const secondTwin = await add(twin);
      const laterOpen = await add({ companyName: '나중회사', status: 'drafting' });

      const list = await call('/api/applications');
      assert.equal(list.status, 200);
      // Drafting, submitted, closed; nearest deadline first, none last; same deadline newest first.
      assert.deepEqual(
        (list.data.applications as Application[]).map((row) => row.id),
        [
          secondTwin.id,
          firstTwin.id,
          farDraft.id,
          laterOpen.id,
          open.id,
          earlySubmitted.id,
          lateSubmitted.id,
          closed.id,
        ],
      );

      // Every column changes, and clearing the link and deadline stores NULL again.
      const updated = await call(`/api/applications/${String(lateSubmitted.id)}`, {
        method: 'PUT',
        body: {
          companyName: '제출회사 본사',
          position: '플랫폼',
          postingUrl: null,
          deadline: null,
          status: 'closed',
          memo: '최종 결과 대기',
        },
      });
      assert.equal(updated.status, 200);
      assert.deepEqual(updated.data.application, {
        id: lateSubmitted.id,
        companyName: '제출회사 본사',
        position: '플랫폼',
        postingUrl: null,
        deadline: null,
        status: 'closed',
        memo: '최종 결과 대기',
      });

      // An update can move a deadline to another date.
      const moved = await call(`/api/applications/${String(earlySubmitted.id)}`, {
        method: 'PUT',
        body: { companyName: '제출회사', status: 'submitted', deadline: '2026-04-15' },
      });
      assert.equal(moved.status, 200);
      assert.equal((moved.data.application as Application).deadline, '2026-04-15');

      // An update the database itself refuses (NUL is valid JSON but not PostgreSQL text) is a
      // 400 and leaves the row as it was.
      const nul = await call(`/api/applications/${String(farDraft.id)}`, {
        method: 'PUT',
        body: { companyName: '먼회사', status: 'submitted', memo: '바뀌면\u0000안 됨' },
      });
      assert.equal(nul.status, 400);
      assert.equal(nul.data.error, '입력에 사용할 수 없는 문자(NUL)가 있습니다');
      const kept = await call('/api/applications');
      assert.deepEqual(
        (kept.data.applications as Application[]).find((row) => row.id === farDraft.id),
        farDraft,
      );

      const removed = await call(`/api/applications/${String(firstTwin.id)}`, {
        method: 'DELETE',
      });
      assert.equal(removed.status, 204);
      const after = await call('/api/applications');
      const ids = (after.data.applications as Application[]).map((row) => row.id);
      assert.equal(ids.length, 7);
      assert.ok(!ids.includes(firstTwin.id));
      assert.ok(ids.includes(secondTwin.id));

      for (const request of [
        { method: 'PUT', body: { companyName: '없는회사', status: 'drafting' } },
        { method: 'DELETE' },
      ]) {
        const missing = await call(`/api/applications/${String(firstTwin.id)}`, request);
        assert.equal(missing.status, 404);
        assert.equal(missing.data.error, '지원 기업을 찾을 수 없습니다');
      }
    });
  },
);

test('the database itself refuses rows the API would refuse', { skip: !url }, async (t) => {
  await lockApplications(t);
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM applications');
  const insert = (companyName: string, status: string, postingUrl: string | null) =>
    pool.query('INSERT INTO applications (company_name, status, posting_url) VALUES ($1, $2, $3)', [
      companyName,
      status,
      postingUrl,
    ]);
  await assert.rejects(insert('', 'drafting', null), /applications_company_name_check/);
  await assert.rejects(insert('한국소프트', 'passed', null), /applications_status_check/);
  await assert.rejects(
    insert('한국소프트', 'drafting', 'javascript:alert(1)'),
    /applications_posting_url_check/,
  );
  await insert('한국소프트', 'drafting', 'HTTPS://example.com');
});
