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
    const { status, data } = await call('/api/applications/1/projects', { method: 'PUT', body });
    assert.equal(status, 400);
    assert.equal(data.error, message);
  });
}

test('the highlighted projects body must be a list of project ids', async () => {
  const idsError = 'Project ids must be a list of project ids';
  await expectRefused([], 'Request body must be a JSON object');
  await expectRefused({}, idsError);
  await expectRefused({ projectIds: 'a' }, idsError);
  await expectRefused({ projectIds: [0] }, idsError);
  await expectRefused({ projectIds: [1.5] }, idsError);
  await expectRefused({ projectIds: ['1'] }, idsError);
  await expectRefused(
    { projectIds: Array.from({ length: 51 }, (_, i) => i + 1) },
    'At most 50 projects can be highlighted',
  );
});

test('an application id that is not a number is refused', async () => {
  await withApi(refusingPool(), async (call) => {
    const { status } = await call('/api/applications/abc/projects');
    assert.equal(status, 400);
  });
});
