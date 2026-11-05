import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const valid = {
  name: '정보처리기사',
  issuer: '한국산업인력공단',
  acquiredDate: '2023-06-09',
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
    const { status, data } = await call('/api/certifications', { method: 'POST', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

test('an expiry date before the acquisition date is refused in Korean', async () => {
  await expectRefused(
    { ...valid, expiryDate: '2023-06-08' },
    '만료일은 취득일보다 빠를 수 없습니다',
  );
});

test('a bad date reports only its own error, not a false ordering error', async () => {
  await expectRefused(
    { ...valid, acquiredDate: '2023-02-30', expiryDate: '2020-01-01' },
    '취득일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
  await expectRefused(
    { ...valid, expiryDate: '2025-13-01' },
    '만료일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
  await expectRefused(
    { ...valid, acquiredDate: undefined },
    '취득일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
});

test('a blank or too long name or issuer is refused', async () => {
  await expectRefused({ ...valid, name: '  ' }, '자격증명을(를) 입력해 주세요');
  await expectRefused({ ...valid, name: undefined }, '자격증명을(를) 입력해 주세요');
  await expectRefused({ ...valid, issuer: '' }, '발급 기관을(를) 입력해 주세요');
  await expectRefused({ ...valid, name: 'a'.repeat(101) }, '자격증명은(는) 100자 이하여야 합니다');
  await expectRefused({ ...valid, issuer: undefined }, '발급 기관을(를) 입력해 주세요');
  await expectRefused(
    { ...valid, issuer: 'a'.repeat(101) },
    '발급 기관은(는) 100자 이하여야 합니다',
  );
});

test('the score is optional text of 50 characters at most', async () => {
  await expectRefused({ ...valid, score: 905 }, '점수·등급은(는) 문자열이어야 합니다');
  await expectRefused({ ...valid, score: 'a'.repeat(51) }, '점수·등급은(는) 50자 이하여야 합니다');
});

test('a memo over 2000 characters is refused', async () => {
  await expectRefused({ ...valid, memo: '가'.repeat(2001) }, '메모은(는) 2000자 이하여야 합니다');
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/certifications/1', {
      method: 'PUT',
      body: { ...valid, expiryDate: '2020-01-01' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '만료일은 취득일보다 빠를 수 없습니다');
  });
});

test('a body that is not an object is refused in Korean', async () => {
  await expectRefused([], '요청 본문은 JSON 객체여야 합니다');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/certifications/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, '자격증 ID가 올바르지 않습니다');
    }
  });
});

test('a missing expiry date and blank optional text reach the database as NULL', async () => {
  const received: unknown[][] = [];
  const pool = {
    query: async (_sql: string, values: unknown[]) => {
      received.push(values);
      return { rows: [{ id: '1' }], rowCount: 1 };
    },
  } as unknown as Pool;
  await withApi(pool, async (call) => {
    const { status } = await call('/api/certifications', {
      method: 'POST',
      body: { ...valid, score: '  ', memo: '' },
    });
    assert.equal(status, 201);
    // The same day is a valid expiry, and null clears it.
    for (const expiryDate of ['2023-06-09', null]) {
      const updated = await call('/api/certifications/1', {
        method: 'PUT',
        body: { ...valid, expiryDate },
      });
      assert.equal(updated.status, 200);
    }
  });
  assert.deepEqual(received, [
    ['정보처리기사', '한국산업인력공단', '2023-06-09', null, null, null],
    [1, '정보처리기사', '한국산업인력공단', '2023-06-09', '2023-06-09', null, null],
    [1, '정보처리기사', '한국산업인력공단', '2023-06-09', null, null, null],
  ]);
});
