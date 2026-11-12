import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const valid = { companyName: '한국소프트', status: 'drafting' };

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
    const { status, data } = await call('/api/applications', { method: 'POST', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

test('a blank, missing or too long company name is refused in English', async () => {
  for (const companyName of ['', '   ', undefined, null]) {
    await expectRefused({ ...valid, companyName }, 'Company name is required');
  }
  await expectRefused(
    { ...valid, companyName: '가'.repeat(101) },
    'Company name must be at most 100 characters',
  );
});

test('the status must be one of the three', async () => {
  const message = 'Application status must be one of drafting, submitted, closed';
  for (const status of ['passed', 'Drafting', '', undefined]) {
    await expectRefused({ ...valid, status }, message);
  }
});

test('the posting link must be an http(s) address', async () => {
  for (const postingUrl of ['javascript:alert(1)', 'example.com/jobs', 'https:example.com']) {
    await expectRefused(
      { ...valid, postingUrl },
      'Job posting link must start with http:// or https://',
    );
  }
  await expectRefused(
    { ...valid, postingUrl: 'https://example.com/a b' },
    'Job posting link must not contain spaces',
  );
});

test('a bad deadline, a long position or a long memo is refused', async () => {
  await expectRefused(
    { ...valid, deadline: '2026-02-30' },
    'Deadline must be a date in YYYY-MM-DD format',
  );
  await expectRefused({ ...valid, deadline: '' }, 'Deadline must be a date in YYYY-MM-DD format');
  await expectRefused(
    { ...valid, position: 'a'.repeat(101) },
    'Position must be at most 100 characters',
  );
  await expectRefused(
    { ...valid, memo: '가'.repeat(2001) },
    'Notes must be at most 2000 characters',
  );
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/applications/1', {
      method: 'PUT',
      body: { ...valid, companyName: ' ' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, 'Company name is required');
  });
});

test('a body that is not an object is refused in English', async () => {
  await expectRefused([], 'Request body must be a JSON object');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/applications/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, 'Invalid application ID');
    }
  });
});

test('missing optional fields reach the database as NULL', async () => {
  const received: unknown[][] = [];
  const pool = {
    query: async (_sql: string, values: unknown[]) => {
      received.push(values);
      return { rows: [{ id: '1' }], rowCount: 1 };
    },
  } as unknown as Pool;
  await withApi(pool, async (call) => {
    const created = await call('/api/applications', {
      method: 'POST',
      body: { ...valid, companyName: '  한국소프트  ', position: ' ', postingUrl: '', memo: '' },
    });
    assert.equal(created.status, 201);
    const updated = await call('/api/applications/1', {
      method: 'PUT',
      body: { ...valid, deadline: null },
    });
    assert.equal(updated.status, 200);
  });
  assert.deepEqual(received, [
    ['한국소프트', null, null, null, 'drafting', null],
    [1, '한국소프트', null, null, null, 'drafting', null],
  ]);
});
