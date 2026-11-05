import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const valid = { name: 'TypeScript', category: 'language', proficiency: 4 };

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
    const { status, data } = await call('/api/skills', { method: 'POST', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

test('a blank or too long skill name is refused', async () => {
  await expectRefused({ ...valid, name: '  ' }, '스킬명을(를) 입력해 주세요');
  await expectRefused({ ...valid, name: undefined }, '스킬명을(를) 입력해 주세요');
  await expectRefused({ ...valid, name: 'a'.repeat(51) }, '스킬명은(는) 50자 이하여야 합니다');
});

test('the category must be one of the six', async () => {
  const message =
    '분류는 언어, 프레임워크·라이브러리, 데이터베이스, 인프라·클라우드, 도구, 기타 중 하나여야 합니다';
  for (const category of ['frontend', 'Language', '', undefined]) {
    await expectRefused({ ...valid, category }, message);
  }
});

test('proficiency is a whole number from 1 to 5', async () => {
  for (const proficiency of [0, 6, 2.5, -1, '3', null, undefined]) {
    await expectRefused({ ...valid, proficiency }, '숙련도는 1~5 사이의 정수여야 합니다');
  }
});

test('a memo over 2000 characters is refused', async () => {
  await expectRefused({ ...valid, memo: '가'.repeat(2001) }, '메모은(는) 2000자 이하여야 합니다');
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/skills/1', {
      method: 'PUT',
      body: { ...valid, proficiency: 7 },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '숙련도는 1~5 사이의 정수여야 합니다');
  });
});

test('a body that is not an object is refused in Korean', async () => {
  await expectRefused([], '요청 본문은 JSON 객체여야 합니다');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/skills/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, '스킬 ID가 올바르지 않습니다');
    }
  });
});

// A pool whose every query fails the way PostgreSQL reports a unique violation.
function duplicatePool(constraint: string) {
  return {
    query: async () => {
      throw Object.assign(new Error('duplicate key value violates unique constraint'), {
        code: '23505',
        constraint,
      });
    },
  } as unknown as Pool;
}

test('a name already taken is a 409 that names the skill, on create and on update', async () => {
  await withApi(duplicatePool('skills_name_unique'), async (call) => {
    for (const [path, method] of [
      ['/api/skills', 'POST'],
      ['/api/skills/1', 'PUT'],
    ] as const) {
      const { status, data } = await call(path, { method, body: valid });
      assert.equal(status, 409);
      assert.equal(data.error, '이미 등록된 스킬입니다');
    }
  });
});

test('another unique violation keeps the general 409 message', async () => {
  await withApi(duplicatePool('skills_pkey'), async (call) => {
    const { status, data } = await call('/api/skills', { method: 'POST', body: valid });
    assert.equal(status, 409);
    assert.equal(data.error, '이미 등록된 항목입니다');
  });
});
