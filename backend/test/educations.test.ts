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

test('a graduation date before the start date is refused in Korean', async () => {
  await expectRefused({ ...valid, endDate: '2015-03-01' }, '졸업일은 입학일보다 빠를 수 없습니다');
});

test('an impossible calendar date is refused', async () => {
  await expectRefused(
    { ...valid, startDate: '2015-02-30' },
    '입학일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
});

test('year 0000 is refused in Korean because PostgreSQL cannot store it', async () => {
  await expectRefused(
    { ...valid, startDate: '0000-01-01', endDate: null },
    '입학일은(는) 0001-01-01 이후여야 합니다',
  );
});

test('a bad date reports only its own error, not a false ordering error', async () => {
  await expectRefused(
    { ...valid, startDate: '2020-13-45', endDate: '2020-01-01' },
    '입학일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
});

test('an enrolled course cannot have a graduation date', async () => {
  await expectRefused(
    { ...valid, status: 'enrolled', endDate: '2019-02-20' },
    '재학 중이면 졸업일을 비워 주세요',
  );
});

test('the gpa scale stops at 100', async () => {
  await expectRefused({ ...valid, gpa: 90, gpaScale: 100.01 }, '만점은(는) 100 이하여야 합니다');
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/educations/1', {
      method: 'PUT',
      body: { ...valid, endDate: '2015-03-01' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '졸업일은 입학일보다 빠를 수 없습니다');
  });
});

test('a blank school name is refused', async () => {
  await expectRefused({ ...valid, school: '   ' }, '학교명을(를) 입력해 주세요');
});

test('an unknown degree or status is refused', async () => {
  await expectRefused(
    { ...valid, degree: 'phd' },
    '학위는 고등학교, 전문학사, 학사, 석사, 박사, 기타 중 하나여야 합니다',
  );
  await expectRefused(
    { ...valid, status: 'done' },
    '상태는 졸업, 재학, 휴학, 중퇴 중 하나여야 합니다',
  );
});

test('gpa needs its scale, must not exceed it, and the scale must be positive', async () => {
  await expectRefused({ ...valid, gpa: 3.5 }, '학점과 만점은 함께 입력해 주세요');
  await expectRefused({ ...valid, gpa: 4.6, gpaScale: 4.5 }, '학점은 만점보다 클 수 없습니다');
  await expectRefused({ ...valid, gpa: 0, gpaScale: 0 }, '만점은 0보다 커야 합니다');
  await expectRefused(
    { ...valid, gpa: 3.123, gpaScale: 4.5 },
    '학점은(는) 소수 둘째 자리까지 입력해 주세요',
  );
});

test('a body that is not an object is refused in Korean', async () => {
  await expectRefused([], '요청 본문은 JSON 객체여야 합니다');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/educations/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, 'Invalid 학력 ID');
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
