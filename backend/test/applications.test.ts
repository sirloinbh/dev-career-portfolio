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

test('the status must be one of the eight hiring stages', async () => {
  const message =
    'Application status must be one of drafting, submitted, document_passed, first_interview, second_interview, offer, rejected, withdrawn';
  for (const status of ['passed', 'Drafting', 'closed', '', undefined]) {
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
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
      received.push(values);
      return { rows: [{ id: 1, status: 'drafting' }], rowCount: 1 };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as unknown as Pool;
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
    // The first history row of the new application: no earlier stage.
    [1, 'drafting'],
    // PUT: the row lock, the update, and no history row because the stage did not change.
    [1],
    [1, '한국소프트', null, null, null, 'drafting', null],
  ]);
});

test('a changed stage writes one history row and an unchanged one writes none', async () => {
  const history: unknown[][] = [];
  const stored = 'submitted';
  const client = {
    query: async (sql: string, values: unknown[] = []) => {
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };
      if (sql.startsWith('SELECT status')) return { rows: [{ status: stored }], rowCount: 1 };
      if (sql.includes('application_status_history')) history.push(values);
      return { rows: [{ id: 1 }], rowCount: 1 };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as unknown as Pool;
  await withApi(pool, async (call) => {
    const put = (status: string) =>
      call('/api/applications/1', { method: 'PUT', body: { ...valid, status } });
    assert.equal((await put('submitted')).status, 200);
    assert.deepEqual(history, []);
    assert.equal((await put('first_interview')).status, 200);
    assert.deepEqual(history, [[1, 'submitted', 'first_interview']]);
  });
});

test('a failed save rolls back and writes no history row', async () => {
  const sent: string[] = [];
  const client = {
    query: async (sql: string) => {
      sent.push(sql.split(/\s/)[0]);
      if (sql.startsWith('UPDATE')) throw new Error('boom');
      return { rows: [{ status: 'drafting' }], rowCount: 1 };
    },
    release: () => undefined,
  };
  const pool = { connect: async () => client } as unknown as Pool;
  await withApi(pool, async (call) => {
    const { status } = await call('/api/applications/1', {
      method: 'PUT',
      body: { ...valid, status: 'offer' },
    });
    assert.equal(status, 500);
  });
  assert.ok(sent.includes('ROLLBACK'));
  assert.ok(!sent.includes('COMMIT'));
  assert.ok(!sent.includes('INSERT'));
});

test('the status history needs a valid application id', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/applications/abc/status-history');
    assert.equal(status, 400);
    assert.equal(data.error, 'Invalid application ID');
  });
});
