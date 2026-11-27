import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// Invalid input must be refused before any query runs or any connection is taken.
function refusingPool() {
  const refuse = async () => {
    throw new Error('validation should have stopped this request');
  };
  return { query: refuse, connect: refuse } as unknown as Pool;
}

const valid = { round: 1, date: '2026-12-01', time: '14:30', format: 'video' };

async function expectRefused(path: string, method: string, body: unknown, message: string) {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call(path, { method, body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

const create = (body: unknown, message: string) =>
  expectRefused('/api/applications/1/interviews', 'POST', body, message);

test('an interview body must be an object with a round, a date, a time and a format', async () => {
  await create([], 'Request body must be a JSON object');
  await create({ ...valid, round: 0 }, 'Round must be a whole number from 1 to 20');
  await create({ ...valid, round: 21 }, 'Round must be a whole number from 1 to 20');
  await create({ ...valid, round: 1.5 }, 'Round must be a whole number from 1 to 20');
  await create({ ...valid, round: '1' }, 'Round must be a whole number from 1 to 20');
  await create({ ...valid, date: '2026-02-30' }, 'Date must be a date in YYYY-MM-DD format');
  await create({ ...valid, time: '24:00' }, 'Time must be in HH:MM format, from 00:00 to 23:59');
  await create({ ...valid, time: '9:30' }, 'Time must be in HH:MM format, from 00:00 to 23:59');
  await create({ ...valid, time: undefined }, 'Time must be in HH:MM format, from 00:00 to 23:59');
  await create({ ...valid, format: 'chat' }, 'Format must be one of phone, video, onsite');
});

test('questions and the retrospective are limited to 5000 characters', async () => {
  await create(
    { ...valid, questions: '가'.repeat(5001) },
    'Questions must be at most 5000 characters',
  );
  await create(
    { ...valid, retrospective: '가'.repeat(5001) },
    'Retrospective must be at most 5000 characters',
  );
});

test('an update is validated like an add, and the ids must be valid', async () => {
  await expectRefused(
    '/api/applications/1/interviews/2',
    'PUT',
    { ...valid, round: 0 },
    'Round must be a whole number from 1 to 20',
  );
  await expectRefused('/api/applications/x/interviews', 'POST', valid, 'Invalid application ID');
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/applications/1/interviews/0', { method: 'DELETE' });
    assert.equal(status, 400);
    assert.equal(data.error, 'Invalid interview ID');
  });
});
