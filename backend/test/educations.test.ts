import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { testDatabaseUrl, withApi } from './helpers.js';

const valid = {
  school: '한국대학교',
  degree: 'bachelor',
  status: 'graduated',
  startDate: '2015-03-02',
  endDate: '2019-02-20',
};

// Invalid input must be refused before any query runs.
function refusingPool() {
  return {
    query: async () => {
      throw new Error('validation should have stopped this request');
    },
  } as unknown as Pool;
}

async function expectRefused(body: unknown, message: string) {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/educations', { method: 'POST', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

test('a graduation date before the start date is refused in English', async () => {
  await expectRefused(
    { ...valid, endDate: '2015-03-01' },
    'Graduation date cannot be earlier than the enrollment date',
  );
});

test('an impossible calendar date is refused', async () => {
  await expectRefused(
    { ...valid, startDate: '2015-02-30' },
    'Enrollment date must be a date in YYYY-MM-DD format',
  );
});

test('year 0000 is refused in English because PostgreSQL cannot store it', async () => {
  await expectRefused(
    { ...valid, startDate: '0000-01-01', endDate: null },
    'Enrollment date must be on or after 0001-01-01',
  );
});

test('a bad date reports only its own error, not a false ordering error', async () => {
  await expectRefused(
    { ...valid, startDate: '2020-13-45', endDate: '2020-01-01' },
    'Enrollment date must be a date in YYYY-MM-DD format',
  );
});

test('an enrolled course cannot have a graduation date', async () => {
  await expectRefused(
    { ...valid, status: 'enrolled', endDate: '2019-02-20' },
    'Graduation date must be empty while enrolled',
  );
});

test('the gpa scale stops at 100', async () => {
  await expectRefused({ ...valid, gpa: 90, gpaScale: 100.01 }, 'Maximum GPA must be at most 100');
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/educations/1', {
      method: 'PUT',
      body: { ...valid, endDate: '2015-03-01' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, 'Graduation date cannot be earlier than the enrollment date');
  });
});

test('a blank school name is refused', async () => {
  await expectRefused({ ...valid, school: '   ' }, 'School is required');
});

test('an unknown degree or status is refused', async () => {
  await expectRefused(
    { ...valid, degree: 'phd' },
    'Degree must be one of high school, associate, bachelor, master, doctorate, other',
  );
  await expectRefused(
    { ...valid, status: 'done' },
    'Status must be one of graduated, enrolled, on leave, dropped out',
  );
});

test('gpa needs its scale, must not exceed it, and the scale must be positive', async () => {
  await expectRefused({ ...valid, gpa: 3.5 }, 'GPA and maximum GPA must be entered together');
  await expectRefused(
    { ...valid, gpa: 4.6, gpaScale: 4.5 },
    'GPA cannot be greater than the maximum GPA',
  );
  await expectRefused({ ...valid, gpa: 0, gpaScale: 0 }, 'Maximum GPA must be greater than 0');
  await expectRefused(
    { ...valid, gpa: 3.123, gpaScale: 4.5 },
    'GPA must have at most two decimal places',
  );
});

test('a body that is not an object is refused in English', async () => {
  await expectRefused([], 'Request body must be a JSON object');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/educations/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, 'Invalid education ID');
    }
  });
});

test('the guard ignores a test database that belongs to another project', () => {
  const original = process.env.TEST_DATABASE_URL;
  try {
    process.env.TEST_DATABASE_URL = 'postgres://study_test@localhost:5432/study_test';
    assert.equal(testDatabaseUrl(), undefined);
    process.env.TEST_DATABASE_URL = 'postgres://career:test@localhost:5432/career_test';
    assert.equal(testDatabaseUrl(), 'postgres://career:test@localhost:5432/career_test');
  } finally {
    if (original === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = original;
  }
});
