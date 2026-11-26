import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { lockApplications, testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

// A fixed service date, so the past-deadline split does not move with the real clock.
const today = '2026-11-16';

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

    await withApi(
      pool,
      async (call) => {
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
          status: 'rejected',
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
        // #83: drafting deadlines already past, the recent one added first; and one due today.
        const yesterday = await add({
          companyName: '어제마감',
          status: 'drafting',
          deadline: '2026-11-15',
        });
        const lastYear = await add({
          companyName: '작년마감',
          status: 'drafting',
          deadline: '2025-12-01',
        });
        const dueToday = await add({
          companyName: '오늘마감',
          status: 'drafting',
          deadline: today,
        });

        const list = await call('/api/applications');
        assert.equal(list.status, 200);
        // Drafting, submitted, then the other stages in order. Inside drafting, past deadlines go after the rest (no deadline
        // included), and due today is not past. Nearest deadline first, none last; same deadline
        // newest first. Submitted and rejected keep that order though their deadlines are past too.
        assert.deepEqual(
          (list.data.applications as Application[]).map((row) => row.id),
          [
            dueToday.id,
            secondTwin.id,
            firstTwin.id,
            farDraft.id,
            laterOpen.id,
            open.id,
            lastYear.id,
            yesterday.id,
            earlySubmitted.id,
            lateSubmitted.id,
            closed.id,
          ],
        );

        // The split follows the service date: a day earlier, 2026-11-15 is due today, not past.
        await withApi(
          pool,
          async (callDayBefore) => {
            const dayBefore = await callDayBefore('/api/applications');
            assert.deepEqual(
              (dayBefore.data.applications as Application[])
                .filter((row) => row.status === 'drafting')
                .map((row) => row.id),
              [
                yesterday.id,
                dueToday.id,
                secondTwin.id,
                firstTwin.id,
                farDraft.id,
                laterOpen.id,
                open.id,
                lastYear.id,
              ],
            );
          },
          { today: () => '2026-11-15' },
        );

        // Every column changes, and clearing the link and deadline stores NULL again.
        const updated = await call(`/api/applications/${String(lateSubmitted.id)}`, {
          method: 'PUT',
          body: {
            companyName: '제출회사 본사',
            position: '플랫폼',
            postingUrl: null,
            deadline: null,
            status: 'rejected',
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
          status: 'rejected',
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
        assert.equal(nul.data.error, 'Input contains a character that is not allowed (NUL)');
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
        assert.equal(ids.length, 10);
        assert.ok(!ids.includes(firstTwin.id));
        assert.ok(ids.includes(secondTwin.id));

        for (const request of [
          { method: 'PUT', body: { companyName: '없는회사', status: 'drafting' } },
          { method: 'DELETE' },
        ]) {
          const missing = await call(`/api/applications/${String(firstTwin.id)}`, request);
          assert.equal(missing.status, 404);
          assert.equal(missing.data.error, 'Application not found');
        }
      },
      { today: () => today },
    );
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

type HistoryRow = { id: number; fromStatus: string | null; status: string; date: string };

test(
  'every status change writes one history row in the same transaction',
  { skip: !url },
  async (t) => {
    await lockApplications(t);
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM applications');

    await withApi(pool, async (call) => {
      const history = async (id: number) => {
        const response = await call(`/api/applications/${String(id)}/status-history`);
        assert.equal(response.status, 200);
        return response.data.history as HistoryRow[];
      };
      const created = await call('/api/applications', {
        method: 'POST',
        body: { companyName: '한국소프트', status: 'drafting' },
      });
      const id = (created.data.application as Application).id;
      const put = (body: Record<string, unknown>) =>
        call(`/api/applications/${String(id)}`, {
          method: 'PUT',
          body: { companyName: '한국소프트', status: 'drafting', ...body },
        });

      // Creating the application writes the first row.
      let rows = await history(id);
      assert.deepEqual(
        rows.map((row) => [row.fromStatus, row.status]),
        [[null, 'drafting']],
      );
      assert.match(rows[0].date, /^\d{4}-\d{2}-\d{2}$/);

      // Saving other fields writes none; each stage change writes exactly one, oldest first.
      assert.equal((await put({ memo: '메모만 바꿈' })).status, 200);
      assert.equal((await history(id)).length, 1);
      assert.equal((await put({ status: 'submitted' })).status, 200);
      assert.equal((await put({ status: 'first_interview' })).status, 200);
      assert.equal((await put({ status: 'offer' })).status, 200);
      rows = await history(id);
      assert.deepEqual(
        rows.map((row) => [row.fromStatus, row.status]),
        [
          [null, 'drafting'],
          ['drafting', 'submitted'],
          ['submitted', 'first_interview'],
          ['first_interview', 'offer'],
        ],
      );

      // A save the database refuses (NUL) changes neither the stage nor the history.
      const refused = await put({ status: 'rejected', memo: '바뀌면\u0000안 됨' });
      assert.equal(refused.status, 400);
      assert.equal((await history(id)).length, 4);
      const list = await call('/api/applications');
      assert.equal((list.data.applications as Application[])[0].status, 'offer');

      // A missing application has no history; deleting one deletes its history.
      const missing = await call('/api/applications/999999999/status-history');
      assert.equal(missing.status, 404);
      assert.equal(
        (await call(`/api/applications/${String(id)}`, { method: 'DELETE' })).status,
        204,
      );
      const left = await pool.query('SELECT 1 FROM application_status_history');
      assert.equal(left.rowCount, 0);
    });
  },
);

test(
  'migration 013 maps every old status and gives each application one history row',
  { skip: !url },
  async () => {
    const { readFile } = await import('node:fs/promises');
    const sql = (name: string) =>
      readFile(new URL(`../../database/migrations/${name}`, import.meta.url), 'utf8');
    const pool = new Pool({ connectionString: url });
    const client = await pool.connect();
    try {
      // A scratch schema holding the old table, rolled back at the end, so no real data is touched.
      await client.query('BEGIN');
      await client.query('CREATE SCHEMA mig_012_test');
      await client.query('SET LOCAL search_path TO mig_012_test');
      await client.query(await sql('007_applications.sql'));
      await client.query(
        `INSERT INTO applications (company_name, status) VALUES
         ('작성중', 'drafting'), ('제출함', 'submitted'), ('종료함', 'closed')`,
      );
      await client.query(await sql('013_application_stages.sql'));
      const statuses = await client.query<{ company_name: string; status: string }>(
        'SELECT company_name, status FROM applications ORDER BY id',
      );
      assert.deepEqual(
        statuses.rows.map((row) => [row.company_name, row.status]),
        [
          ['작성중', 'drafting'],
          ['제출함', 'submitted'],
          ['종료함', 'rejected'],
        ],
      );
      const history = await client.query<{ status: string; from_status: string | null }>(
        `SELECT h.status, h.from_status FROM application_status_history h
       JOIN applications a ON a.id = h.application_id ORDER BY a.id`,
      );
      assert.deepEqual(
        history.rows.map((row) => [row.from_status, row.status]),
        [
          [null, 'drafting'],
          [null, 'submitted'],
          [null, 'rejected'],
        ],
      );
      // The old value is no longer allowed.
      await client.query('SAVEPOINT refused');
      await assert.rejects(
        client.query(`INSERT INTO applications (company_name, status) VALUES ('x', 'closed')`),
        /applications_status_check/,
      );
      await client.query('ROLLBACK TO SAVEPOINT refused');
      // Running the file again changes nothing (migrations must be safe to run twice).
      await client.query(await sql('013_application_stages.sql'));
      const again = await client.query('SELECT 1 FROM application_status_history');
      assert.equal(again.rowCount, 3);
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      client.release();
      await pool.end();
    }
  },
);
