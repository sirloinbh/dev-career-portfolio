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

test('a leaving date before the joining date is refused in Korean', async () => {
  await expectRefused({ ...valid, endDate: '2019-03-03' }, '퇴사일은 입사일보다 빠를 수 없습니다');
});

test('a bad date reports only its own error, not a false ordering error', async () => {
  await expectRefused(
    { ...valid, startDate: '2019-02-30', endDate: '2019-01-01' },
    '입사일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
});

test('a blank company name is refused', async () => {
  await expectRefused({ ...valid, company: '   ' }, '회사명을(를) 입력해 주세요');
});

test('a missing or unknown employment type is refused', async () => {
  await expectRefused(
    { ...valid, employmentType: undefined },
    '고용 형태는 정규직, 계약직, 인턴, 프리랜서, 기타 중 하나여야 합니다',
  );
  await expectRefused(
    { ...valid, employmentType: 'part_time' },
    '고용 형태는 정규직, 계약직, 인턴, 프리랜서, 기타 중 하나여야 합니다',
  );
});

test('long text is refused with its own limit', async () => {
  await expectRefused({ ...valid, position: '가'.repeat(101) }, '직책은(는) 100자 이하여야 합니다');
  await expectRefused(
    { ...valid, achievements: '가'.repeat(2001) },
    '주요 성과은(는) 2000자 이하여야 합니다',
  );
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/careers/1', {
      method: 'PUT',
      body: { ...valid, endDate: '2019-03-03' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '퇴사일은 입사일보다 빠를 수 없습니다');
  });
});

test('a body that is not an object is refused in Korean', async () => {
  await expectRefused([], '요청 본문은 JSON 객체여야 합니다');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/careers/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, '이력 ID가 올바르지 않습니다');
    }
  });
});
