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
  await expectRefused([], '요청 본문은 JSON 객체여야 합니다');
  await expectRefused({}, '문항 목록(questions)을 배열로 보내 주세요');
  await expectRefused({ questions: question }, '문항 목록(questions)을 배열로 보내 주세요');
  await expectRefused({ questions: ['문항'] }, '1번째 문항: 문항은 객체여야 합니다');
});

test('a field error names the question it belongs to', async () => {
  await expectRefused(
    { questions: [question, { ...question, question: '  ' }] },
    '2번째 문항: 문항을(를) 입력해 주세요',
  );
  await expectRefused(
    { questions: [{ ...question, question: '가'.repeat(501) }] },
    '1번째 문항: 문항은(는) 500자 이하여야 합니다',
  );
  await expectRefused(
    { questions: [{ ...question, answer: '가'.repeat(5001) }] },
    '1번째 문항: 답변은(는) 5000자 이하여야 합니다',
  );
});

test('a character limit is a whole number from 1 to 5000', async () => {
  const message = '1번째 문항: 글자 수 제한은 1 이상 5000 이하의 정수여야 합니다';
  for (const charLimit of [0, -1, 5001, 1.5, '1000']) {
    await expectRefused({ questions: [{ ...question, charLimit }] }, message);
  }
});

test('question ids must be valid and appear only once', async () => {
  const message = '1번째 문항: 문항 ID가 올바르지 않습니다';
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
    '같은 문항이 두 번 들어 있습니다',
  );
});

test('one application holds at most ten questions', async () => {
  await expectRefused(
    { questions: Array.from({ length: 11 }, () => question) },
    '문항은 10개까지 입력할 수 있습니다',
  );
});

test('malformed ids in the path are refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const [path, request, message] of [
      ['/api/applications/abc/questions', {}, '지원 기업 ID가 올바르지 않습니다'],
      [
        '/api/applications/0/questions',
        { method: 'PUT', body: { questions: [] } },
        '지원 기업 ID가 올바르지 않습니다',
      ],
      [
        '/api/applications/1/questions/x',
        { method: 'DELETE' },
        '자기소개서 문항 ID가 올바르지 않습니다',
      ],
    ] as const) {
      const { status, data } = await call(path, request);
      assert.equal(status, 400);
      assert.equal(data.error, message);
    }
  });
});
