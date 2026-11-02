import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

const university = {
  school: '  한국대학교  ',
  major: '컴퓨터공학',
  degree: 'bachelor',
  status: 'graduated',
  startDate: '2015-03-02',
  endDate: '2019-02-20',
  gpa: 3.75,
  gpaScale: 4.5,
  memo: '',
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'educations are stored, listed newest first, updated and deleted',
  { skip: !url },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM educations');

    await withApi(pool, async (call) => {
      // Still enrolled: the end date stays NULL and the optional fields stay NULL too.
      // Inserted first with the later start date, so the list order proves it sorts by date, not id.
      const enrolled = await call('/api/educations', {
        method: 'POST',
        body: {
          school: '대학원',
          degree: 'master',
          status: 'enrolled',
          startDate: '2024-03-04',
        },
      });
      assert.equal(enrolled.status, 201);
      const graduate = enrolled.data.education as Record<string, unknown>;
      assert.equal(graduate.endDate, null);
      assert.equal(graduate.major, null);
      assert.equal(graduate.gpa, null);

      const created = await call('/api/educations', { method: 'POST', body: university });
      assert.equal(created.status, 201);
      const education = created.data.education as Record<string, unknown>;
      assert.equal(typeof education.id, 'number');
      assert.deepEqual(education, {
        id: education.id,
        school: '한국대학교',
        major: '컴퓨터공학',
        degree: 'bachelor',
        status: 'graduated',
        startDate: '2015-03-02',
        endDate: '2019-02-20',
        gpa: 3.75,
        gpaScale: 4.5,
        memo: null,
      });

      const list = await call('/api/educations');
      assert.equal(list.status, 200);
      const schools = (list.data.educations as { school: string }[]).map((row) => row.school);
      assert.deepEqual(schools, ['대학원', '한국대학교']);

      const updated = await call(`/api/educations/${String(education.id)}`, {
        method: 'PUT',
        body: { ...university, status: 'dropped_out', gpa: null, gpaScale: null },
      });
      assert.equal(updated.status, 200);
      const changed = updated.data.education as Record<string, unknown>;
      assert.equal(changed.status, 'dropped_out');
      assert.equal(changed.gpa, null);

      const removed = await call(`/api/educations/${String(education.id)}`, { method: 'DELETE' });
      assert.equal(removed.status, 204);
      const after = await call('/api/educations');
      assert.equal((after.data.educations as unknown[]).length, 1);

      for (const request of [{ method: 'PUT', body: university }, { method: 'DELETE' }]) {
        const missing = await call(`/api/educations/${String(education.id)}`, request);
        assert.equal(missing.status, 404);
        assert.equal(missing.data.error, '학력을 찾을 수 없습니다');
      }
    });
  },
);

test('the database itself refuses rows the API would refuse', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const insert = (status: string, end: string | null, gpa: number | null, scale: number | null) =>
    pool.query(
      `INSERT INTO educations (school, degree, status, start_date, end_date, gpa, gpa_scale)
       VALUES ('학교', 'other', $1, '2020-01-02', $2, $3, $4)`,
      [status, end, gpa, scale],
    );
  await assert.rejects(insert('graduated', '2020-01-01', null, null), /educations_period/);
  await assert.rejects(insert('enrolled', '2020-01-03', null, null), /educations_enrolled_open/);
  await assert.rejects(insert('graduated', null, 3.5, null), /educations_gpa_pair/);
  await assert.rejects(insert('graduated', null, 4.6, 4.5), /educations_gpa_range/);
  await assert.rejects(insert('graduated', null, 500, 900), /educations_gpa_range/);
});

test('a NUL character in text is a 400, not a server error', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/educations', {
      method: 'POST',
      body: {
        school: '학\u0000교',
        degree: 'other',
        status: 'graduated',
        startDate: '2020-01-02',
      },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '입력에 사용할 수 없는 문자(NUL)가 있습니다');
  });
});
