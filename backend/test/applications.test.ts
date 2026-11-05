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

test('a blank, missing or too long company name is refused in Korean', async () => {
  for (const companyName of ['', '   ', undefined, null]) {
    await expectRefused({ ...valid, companyName }, '기업명을(를) 입력해 주세요');
  }
  await expectRefused(
    { ...valid, companyName: '가'.repeat(101) },
    '기업명은(는) 100자 이하여야 합니다',
  );
});

test('the status must be one of the three', async () => {
  const message = '지원 상태는 작성 중, 제출 완료, 종료 중 하나여야 합니다';
  for (const status of ['passed', 'Drafting', '', undefined]) {
    await expectRefused({ ...valid, status }, message);
  }
});

test('the posting link must be an http(s) address', async () => {
  for (const postingUrl of ['javascript:alert(1)', 'example.com/jobs', 'https:example.com']) {
    await expectRefused(
      { ...valid, postingUrl },
      '채용 공고 링크은(는) http:// 또는 https://로 시작하는 주소여야 합니다',
    );
  }
  await expectRefused(
    { ...valid, postingUrl: 'https://example.com/a b' },
    '채용 공고 링크에는 공백을 넣을 수 없습니다',
  );
});

test('a bad deadline, a long position or a long memo is refused', async () => {
  await expectRefused(
    { ...valid, deadline: '2026-02-30' },
    '마감일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
  await expectRefused({ ...valid, deadline: '' }, '마감일은(는) YYYY-MM-DD 형식의 날짜여야 합니다');
  await expectRefused(
    { ...valid, position: 'a'.repeat(101) },
    '지원 직무은(는) 100자 이하여야 합니다',
  );
  await expectRefused({ ...valid, memo: '가'.repeat(2001) }, '메모은(는) 2000자 이하여야 합니다');
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/applications/1', {
      method: 'PUT',
      body: { ...valid, companyName: ' ' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '기업명을(를) 입력해 주세요');
  });
});

test('a body that is not an object is refused in Korean', async () => {
  await expectRefused([], '요청 본문은 JSON 객체여야 합니다');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/applications/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, '지원 기업 ID가 올바르지 않습니다');
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
