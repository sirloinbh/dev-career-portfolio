import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const valid = {
  company: '한빛소프트',
  employmentType: 'full_time',
  startDate: '2019-03-04',
  endDate: '2023-06-30',
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
    const { status, data } = await call('/api/careers', { method: 'POST', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

test('a leaving date before the joining date is refused in English', async () => {
  await expectRefused(
    { ...valid, endDate: '2019-03-03' },
    'End date cannot be earlier than start date',
  );
});

test('a bad date reports only its own error, not a false ordering error', async () => {
  await expectRefused(
    { ...valid, startDate: '2019-02-30', endDate: '2019-01-01' },
    'Start date must be a date in YYYY-MM-DD format',
  );
});

test('a blank company name is refused', async () => {
  await expectRefused({ ...valid, company: '   ' }, 'Company is required');
});

test('a missing or unknown employment type is refused', async () => {
  await expectRefused(
    { ...valid, employmentType: undefined },
    'Employment type must be one of full-time, contract, intern, freelance, other',
  );
  await expectRefused(
    { ...valid, employmentType: 'part_time' },
    'Employment type must be one of full-time, contract, intern, freelance, other',
  );
});

test('long text is refused with its own limit', async () => {
  await expectRefused(
    { ...valid, position: '가'.repeat(101) },
    'Job title must be at most 100 characters',
  );
  await expectRefused(
    { ...valid, achievements: '가'.repeat(2001) },
    'Achievements must be at most 2000 characters',
  );
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/careers/1', {
      method: 'PUT',
      body: { ...valid, endDate: '2019-03-03' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, 'End date cannot be earlier than start date');
  });
});

test('a body that is not an object is refused in English', async () => {
  await expectRefused([], 'Request body must be a JSON object');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/careers/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, 'Invalid career ID');
    }
  });
});
