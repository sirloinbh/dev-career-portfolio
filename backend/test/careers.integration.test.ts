import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

// All companies here are made up for the test.
const startup = {
  company: '  한빛소프트  ',
  department: '플랫폼팀',
  position: '백엔드 개발자',
  employmentType: 'full_time',
  startDate: '2019-03-04',
  endDate: '2023-06-30',
  duties: '주문 API 개발',
  achievements: '',
};

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test('careers are stored, listed newest first, updated and deleted', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  await pool.query('DELETE FROM careers');

  await withApi(pool, async (call) => {
    // Start dates go 2017, 2023, 2019 in insertion order, so neither id order matches the expected list.
    const intern = await call('/api/careers', {
      method: 'POST',
      body: {
        company: '누리랩',
        employmentType: 'intern',
        startDate: '2017-07-03',
        endDate: '2017-08-31',
      },
    });
    assert.equal(intern.status, 201);

    // Still working there: the end date stays NULL and the optional fields stay NULL too.
    const current = await call('/api/careers', {
      method: 'POST',
      body: { company: '다온테크', employmentType: 'contract', startDate: '2023-07-03' },
    });
    assert.equal(current.status, 201);
    const job = current.data.career as Record<string, unknown>;
    assert.equal(job.endDate, null);
    assert.equal(job.department, null);
    assert.equal(job.duties, null);

    const created = await call('/api/careers', { method: 'POST', body: startup });
    assert.equal(created.status, 201);
    const career = created.data.career as Record<string, unknown>;
    assert.equal(typeof career.id, 'number');
    assert.deepEqual(career, {
      id: career.id,
      company: '한빛소프트',
      department: '플랫폼팀',
      position: '백엔드 개발자',
      employmentType: 'full_time',
      startDate: '2019-03-04',
      endDate: '2023-06-30',
      duties: '주문 API 개발',
      achievements: null,
    });

    const list = await call('/api/careers');
    assert.equal(list.status, 200);
    const companies = (list.data.careers as { company: string }[]).map((row) => row.company);
    assert.deepEqual(companies, ['다온테크', '한빛소프트', '누리랩']);

    const updated = await call(`/api/careers/${String(career.id)}`, {
      method: 'PUT',
      body: {
        company: '한빛소프트',
        department: '결제팀',
        position: '팀장',
        employmentType: 'freelance',
        startDate: '2019-03-05',
        endDate: null,
        duties: '결제 API 개발',
        achievements: '장애 50% 감소',
      },
    });
    assert.equal(updated.status, 200);
    // Every column changes, so a column left out of SET or two swapped parameters would show here.
    assert.deepEqual(updated.data.career, {
      id: career.id,
      company: '한빛소프트',
      department: '결제팀',
      position: '팀장',
      employmentType: 'freelance',
      startDate: '2019-03-05',
      endDate: null,
      duties: '결제 API 개발',
      achievements: '장애 50% 감소',
    });

    const removed = await call(`/api/careers/${String(career.id)}`, { method: 'DELETE' });
    assert.equal(removed.status, 204);
    const after = await call('/api/careers');
    assert.equal((after.data.careers as unknown[]).length, 2);

    for (const request of [{ method: 'PUT', body: startup }, { method: 'DELETE' }]) {
      const missing = await call(`/api/careers/${String(career.id)}`, request);
      assert.equal(missing.status, 404);
      assert.equal(missing.data.error, '이력을 찾을 수 없습니다');
    }
  });
});

test('the database itself refuses rows the API would refuse', { skip: !url }, async (t) => {
  const pool = new Pool({ connectionString: url });
  t.after(() => pool.end());
  const insert = (company: string, type: string, end: string | null) =>
    pool.query(
      `INSERT INTO careers (company, employment_type, start_date, end_date)
       VALUES ($1, $2, '2020-01-02', $3)`,
      [company, type, end],
    );
  await assert.rejects(insert('회사', 'full_time', '2020-01-01'), /careers_period/);
  await assert.rejects(insert('회사', 'part_time', null), /careers_employment_type_check/);
  await assert.rejects(insert('', 'full_time', null), /careers_company_check/);
});

test(
  'every employment type the API accepts is stored, and a same-day tie lists the later row first',
  {
    skip: !url,
  },
  async (t) => {
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM careers');
    // The next ids are 9 to 13, so a text sort ("10" before "9") would show on any database.
    await pool.query("SELECT setval(pg_get_serial_sequence('careers', 'id'), 8)");
    await withApi(pool, async (call) => {
      const types = ['full_time', 'contract', 'intern', 'freelance', 'other'];
      for (const employmentType of types) {
        const { status } = await call('/api/careers', {
          method: 'POST',
          // Same start date for all, and a one-day job (end date equal to the start date).
          body: {
            company: employmentType,
            employmentType,
            startDate: '2020-01-02',
            endDate: '2020-01-02',
          },
        });
        assert.equal(status, 201, employmentType);
      }
      const list = await call('/api/careers');
      const companies = (list.data.careers as { company: string }[]).map((row) => row.company);
      assert.deepEqual(companies, [...types].reverse());
    });
  },
);
