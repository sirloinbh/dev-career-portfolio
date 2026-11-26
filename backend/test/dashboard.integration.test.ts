import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Client, type Pool } from 'pg';

import { lockApplications, testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

// A fixed service date, so the window edges do not move with the real clock.
const today = '2026-11-16';

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test('the dashboard counts, windows and recent changes (#221)', { skip: !url }, async (t) => {
  await lockApplications(t);
  const client = new Client({ connectionString: url });
  await client.connect();
  t.after(() => client.end());
  // Fixtures live in one transaction that is rolled back, and the table locks keep the other test
  // files (which run in parallel and empty these tables) out until then.
  await client.query('BEGIN');
  t.after(() => client.query('ROLLBACK'));
  await client.query(
    `LOCK TABLE applications, careers, certifications, educations, projects, skills
     IN ACCESS EXCLUSIVE MODE`,
  );
  for (const table of [
    'applications',
    'careers',
    'certifications',
    'educations',
    'projects',
    'skills',
  ]) {
    await client.query(`DELETE FROM ${table}`);
  }

  const shim = {
    query: (...args: unknown[]) => (client.query as (...a: unknown[]) => unknown)(...args),
  } as unknown as Pool;
  await withApi(
    shim,
    async (call) => {
      const none = await call('/api/dashboard');
      assert.equal(none.status, 200);
      assert.deepEqual(none.data, {
        today,
        windows: { deadlineDays: 14, expiryDays: 90 },
        counts: {
          educations: 0,
          careers: 0,
          projects: 0,
          skills: 0,
          certifications: 0,
          applications: 0,
        },
        upcomingDeadlines: [],
        expiringCertifications: [],
        recentlyChanged: [],
      });

      // Deadlines: 2026-11-16 + 14 days = 2026-11-30 is the last day inside the window.
      const application = (company: string, status: string, deadline: string | null) =>
        client.query(
          `INSERT INTO applications (company_name, status, deadline) VALUES ($1, $2, $3)`,
          [company, status, deadline],
        );
      await application('Past', 'drafting', '2026-11-15');
      await application('Today', 'drafting', '2026-11-16');
      await application('Edge', 'drafting', '2026-11-30');
      await application('Outside', 'drafting', '2026-12-01');
      await application('Sent', 'submitted', '2026-11-20');
      await application('Open', 'drafting', null);
      await application('Soon', 'drafting', '2026-11-18');

      // Expiry: 2026-11-16 + 90 days = 2027-02-14.
      const certification = (name: string, expiry: string | null) =>
        client.query(
          `INSERT INTO certifications (name, issuer, acquired_date, expiry_date)
           VALUES ($1, '한국산업인력공단', '2020-01-01', $2)`,
          [name, expiry],
        );
      await certification('Expired', '2026-11-15');
      await certification('정보처리기사', '2026-11-16');
      await certification('Edge', '2027-02-14');
      await certification('Outside', '2027-02-15');
      await certification('Forever', null);
      await client.query(
        `INSERT INTO skills (name, category, proficiency) VALUES ('Go', 'language', 3)`,
      );
      await client.query(
        `INSERT INTO educations (school, degree, status, start_date)
         VALUES ('한국대학교', 'bachelor', 'enrolled', '2020-03-02')`,
      );

      const { data } = await call('/api/dashboard');
      assert.deepEqual(data.counts, {
        educations: 1,
        careers: 0,
        projects: 0,
        skills: 1,
        certifications: 5,
        applications: 7,
      });
      assert.deepEqual(
        (data.upcomingDeadlines as { companyName: string; deadline: string }[]).map((row) => [
          row.companyName,
          row.deadline,
        ]),
        [
          ['Today', '2026-11-16'],
          ['Soon', '2026-11-18'],
          ['Edge', '2026-11-30'],
        ],
      );
      assert.deepEqual(
        (data.expiringCertifications as { name: string; expiryDate: string }[]).map((row) => [
          row.name,
          row.expiryDate,
        ]),
        [
          ['정보처리기사', '2026-11-16'],
          ['Edge', '2027-02-14'],
        ],
      );

      // Newest change first, at most five; fixed timestamps make the order certain.
      await client.query(`UPDATE applications SET updated_at = '2026-01-01T00:00:00Z'`);
      await client.query(`UPDATE certifications SET updated_at = '2026-01-02T00:00:00Z'`);
      await client.query(`UPDATE skills SET updated_at = '2026-06-01T00:00:00Z'`);
      await client.query(`UPDATE educations SET updated_at = '2026-05-01T00:00:00Z'`);
      const recent = (await call('/api/dashboard')).data.recentlyChanged as {
        section: string;
        title: string;
      }[];
      assert.equal(recent.length, 5);
      assert.deepEqual(
        recent.slice(0, 2).map((row) => [row.section, row.title]),
        [
          ['skills', 'Go'],
          ['educations', '한국대학교'],
        ],
      );
    },
    { today: () => today },
  );
});
