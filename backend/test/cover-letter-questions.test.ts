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

async function expectRefused(body: unknown, message: string) {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/applications/1/questions', { method: 'PUT', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

const question = { question: '지원 동기를 적어 주세요', answer: '', charLimit: 1000 };

test('the list must be an object holding a questions array', async () => {
  await expectRefused([], 'Request body must be a JSON object');
  await expectRefused({}, 'Send the question list (questions) as an array');
  await expectRefused({ questions: question }, 'Send the question list (questions) as an array');
  await expectRefused({ questions: ['문항'] }, 'Question 1: Question must be an object');
});

test('a field error names the question it belongs to', async () => {
  await expectRefused(
    { questions: [question, { ...question, question: '  ' }] },
    'Question 2: Question is required',
  );
  await expectRefused(
    { questions: [{ ...question, question: '가'.repeat(501) }] },
    'Question 1: Question must be at most 500 characters',
  );
  await expectRefused(
    { questions: [{ ...question, answer: '가'.repeat(5001) }] },
    'Question 1: Answer must be at most 5000 characters',
  );
});

test('a character limit is a whole number from 1 to 5000', async () => {
  const message = 'Question 1: Character limit must be a whole number from 1 to 5000';
  for (const charLimit of [0, -1, 5001, 1.5, '1000']) {
    await expectRefused({ questions: [{ ...question, charLimit }] }, message);
  }
});

test('question ids must be valid and appear only once', async () => {
  const message = 'Question 1: Invalid question ID';
  for (const id of [0, -3, 1.5, '7', 1e15]) {
    await expectRefused({ questions: [{ ...question, id }] }, message);
  }
  await expectRefused(
    {
      questions: [
        { ...question, id: 7 },
        { ...question, id: 7 },
      ],
    },
    'The same question appears twice',
  );
});

test('one application holds at most ten questions', async () => {
  await expectRefused(
    { questions: Array.from({ length: 11 }, () => question) },
    'Questions can have at most 10 items',
  );
});

test('malformed ids in the path are refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const [path, request, message] of [
      ['/api/applications/abc/questions', {}, 'Invalid application ID'],
      [
        '/api/applications/0/questions',
        { method: 'PUT', body: { questions: [] } },
        'Invalid application ID',
      ],
      ['/api/applications/1/questions/x', { method: 'DELETE' }, 'Invalid cover letter question ID'],
    ] as const) {
      const { status, data } = await call(path, request);
      assert.equal(status, 400);
      assert.equal(data.error, message);
    }
  });
});
