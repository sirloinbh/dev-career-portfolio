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

test('an end date before the start date is refused in English', async () => {
  await expectRefused(
    { ...valid, endDate: '2024-01-07' },
    'End date cannot be earlier than start date',
  );
});

test('a bad date reports only its own error, not a false ordering error', async () => {
  await expectRefused(
    { ...valid, startDate: '2024-02-30', endDate: '2024-01-01' },
    'Start date must be a date in YYYY-MM-DD format',
  );
});

test('a blank project name is refused', async () => {
  await expectRefused({ ...valid, name: '  ' }, 'Project name is required');
});

test('links must be http or https addresses', async () => {
  const message = 'Repository link must start with http:// or https://';
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
    await expectRefused({ ...valid, repositoryUrl }, 'Repository link must not contain spaces');
  }
  await expectRefused(
    { ...valid, serviceUrl: 'mailto:someone@example.com' },
    'Service link must start with http:// or https://',
  );
  await expectRefused(
    { ...valid, serviceUrl: `https://example.com/${'a'.repeat(500)}` },
    'Service link must be at most 500 characters',
  );
});

test('technology names are checked one by one and as a list', async () => {
  await expectRefused({ ...valid, technologies: 'React' }, 'Technologies must be a list');
  await expectRefused(
    { ...valid, technologies: ['React', ' '] },
    'Technologies items cannot be empty',
  );
  await expectRefused({ ...valid, technologies: [1] }, 'Technologies items must be text');
  await expectRefused(
    { ...valid, technologies: ['가'.repeat(51)] },
    'Technologies items must be at most 50 characters',
  );
  await expectRefused(
    { ...valid, technologies: Array.from({ length: 31 }, (_, index) => `기술${String(index)}`) },
    'Technologies can have at most 30 items',
  );
  await expectRefused(
    { ...valid, technologies: ['React', ' react '] },
    'Technologies contain a duplicate item',
  );
});

test('an update is validated the same way as a create', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status, data } = await call('/api/projects/1', {
      method: 'PUT',
      body: { ...valid, repositoryUrl: 'not-a-link' },
    });
    assert.equal(status, 400);
    assert.equal(data.error, 'Repository link must start with http:// or https://');
  });
});

test('a body that is not an object is refused in English', async () => {
  await expectRefused([], 'Request body must be a JSON object');
});

test('a malformed id is refused before any query', async () => {
  await withApi(refusingPool(), async (call) => {
    for (const request of [{ method: 'PUT', body: valid }, { method: 'DELETE' }]) {
      const { status, data } = await call('/api/projects/abc', request);
      assert.equal(status, 400);
      assert.equal(data.error, 'Invalid project ID');
    }
  });
});
