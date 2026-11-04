import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

const valid = {
  name: '주문 관리 서비스',
  startDate: '2024-01-08',
  endDate: '2024-06-28',
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
    const { status, data } = await call('/api/projects', { method: 'POST', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

test('an end date before the start date is refused in Korean', async () => {
  await expectRefused({ ...valid, endDate: '2024-01-07' }, '종료일은 시작일보다 빠를 수 없습니다');
});

test('a bad date reports only its own error, not a false ordering error', async () => {
  await expectRefused(
    { ...valid, startDate: '2024-02-30', endDate: '2024-01-01' },
    '시작일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
});

test('a blank project name is refused', async () => {
  await expectRefused({ ...valid, name: '  ' }, '프로젝트명을(를) 입력해 주세요');
});

test('links must be http or https addresses', async () => {
  const message = '저장소 링크은(는) http:// 또는 https://로 시작하는 주소여야 합니다';
  for (const repositoryUrl of [
    'github.com/someone/repo',
    'javascript:alert(1)',
    'ftp://example.com/repo',
    'file:///C:/repo',
    'https://',
    // Node's URL parser repairs these into https://example.com/, but the DB check would reject the
    // raw text with a 500, so the server must refuse them first.
    'https:example.com',
    'https:/example.com',
    'https:\\\\example.com',
  ]) {
    await expectRefused({ ...valid, repositoryUrl }, message);
  }
  // URL drops tabs and line breaks silently, so the stored text would differ from the opened link.
  // The message names the space, since these addresses already start with http(s)://.
  for (const repositoryUrl of [
    'http://exa\tmple.com',
    'https://example.com/a\nb',
    'https://example.com/my file',
    'https://example.com/a　b',
  ]) {
    await expectRefused({ ...valid, repositoryUrl }, '저장소 링크에는 공백을 넣을 수 없습니다');
  }
  await expectRefused(
    { ...valid, serviceUrl: 'mailto:someone@example.com' },
    '서비스 링크은(는) http:// 또는 https://로 시작하는 주소여야 합니다',
  );
  await expectRefused(
    { ...valid, serviceUrl: `https://example.com/${'a'.repeat(500)}` },
    '서비스 링크은(는) 500자 이하여야 합니다',
  );
});

test('technology names are checked one by one and as a list', async () => {
  await expectRefused({ ...valid, technologies: 'React' }, '사용 기술은(는) 목록이어야 합니다');
  await expectRefused(
    { ...valid, technologies: ['React', ' '] },
    '사용 기술 항목을 비울 수 없습니다',
  );
  await expectRefused({ ...valid, technologies: [1] }, '사용 기술 항목은 문자열이어야 합니다');
  await expectRefused(
    { ...valid, technologies: ['가'.repeat(51)] },
    '사용 기술 항목은 50자 이하여야 합니다',
  );
  await expectRefused(
    { ...valid, technologies: Array.from({ length: 31 }, (_, index) => `기술${String(index)}`) },
    '사용 기술은 30개까지 입력할 수 있습니다',
  );
  await expectRefused(
    { ...valid, technologies: ['React', ' react '] },
    '사용 기술에 중복된 항목이 있습니다',
  );
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/projects/1', {
      method: 'PUT',
      body: { ...valid, repositoryUrl: 'not-a-link' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, '저장소 링크은(는) http:// 또는 https://로 시작하는 주소여야 합니다');
  });
});

test('a body that is not an object is refused in Korean', async () => {
  await expectRefused([], '요청 본문은 JSON 객체여야 합니다');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/projects/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, '프로젝트 ID가 올바르지 않습니다');
    }
  });
});
