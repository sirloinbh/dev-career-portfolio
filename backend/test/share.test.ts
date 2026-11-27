import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { withApi } from './helpers.js';

// Share links (#236) with a scripted pool: the route logic, the public/private split and the refusals need no database.
type Call = { sql: string; params: unknown[] };

function scriptedPool(answer: (call: Call) => unknown[]) {
  const calls: Call[] = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      const rows = answer({ sql, params });
      return { rows, rowCount: rows.length };
    },
  } as unknown as Pool;
  return { pool, calls };
}

const refuseAll = (_req: unknown, res: { status(code: number): { json(body: unknown): void } }) => {
  res.status(401).json({ error: 'unauthorized' });
};

const validToken = 'A'.repeat(43);

test('a malformed token is a 404 and never reaches the database', async () => {
  const { pool, calls } = scriptedPool(() => []);
  await withApi(pool, async (call) => {
    for (const token of ['abc', 'A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}!`]) {
      const { status, data } = await call(`/api/share/${token}`);
      assert.equal(status, 404, token);
      assert.equal(data.error, 'Share link not found');
    }
  });
  assert.equal(calls.length, 0);
});

test('an unknown or revoked token is a 404', async () => {
  const { pool, calls } = scriptedPool(() => []);
  await withApi(pool, async (call) => {
    const { status } = await call(`/api/share/${validToken}`);
    assert.equal(status, 404);
  });
  const lookup = calls[0];
  assert.match(lookup?.sql ?? '', /revoked_at IS NULL/);
  // Only the hash goes to the database, never the token.
  assert.deepEqual(lookup?.params, [createHash('sha256').update(validToken).digest('hex')]);
});

test('the public route works without a session and returns only the chosen items', async () => {
  const { pool, calls } = scriptedPool(({ sql }) => {
    if (sql.includes('FROM share_links'))
      return [
        { id: 1, label: 'For ACME', items: { projects: [7] }, createdAt: 'x', revokedAt: null },
      ];
    if (sql.includes('FROM projects')) return [{ id: 7, name: 'Orders' }];
    return [];
  });
  await withApi(
    pool,
    async (call) => {
      const shared = await call(`/api/share/${validToken}`);
      assert.equal(shared.status, 200);
      assert.deepEqual(shared.data, {
        label: 'For ACME',
        careers: [],
        projects: [{ id: 7, name: 'Orders' }],
        educations: [],
        certifications: [],
      });
      assert.equal(shared.headers.get('cache-control'), 'no-store');
      assert.equal(shared.headers.get('referrer-policy'), 'no-referrer');
      assert.match(shared.headers.get('x-robots-tag') ?? '', /noindex/);
      // The query for a kind with no chosen ids never runs.
      assert.equal(calls.filter((c) => c.sql.includes('FROM careers')).length, 0);
      // The project query asks only for the chosen ids and never selects private columns.
      const projects = calls.find((c) => c.sql.includes('FROM projects'));
      assert.deepEqual(projects?.params, [[7]]);
      assert.doesNotMatch(projects?.sql ?? '', /memo/);
    },
    { auth: refuseAll },
  );
});

test('the shared page cannot reach any other API: every other route still needs the sign-in', async () => {
  const { pool, calls } = scriptedPool(() => []);
  await withApi(
    pool,
    async (call) => {
      for (const [path, method] of [
        ['/api/projects', 'GET'],
        ['/api/projects', 'POST'],
        ['/api/careers/1', 'PUT'],
        ['/api/share-links', 'GET'],
        ['/api/share-links', 'POST'],
        ['/api/share-links/1/revoke', 'POST'],
        [`/api/share/${validToken}`, 'POST'],
        [`/api/share/${validToken}`, 'DELETE'],
        ['/api/data/export', 'GET'],
      ] as const) {
        const { status } = await call(path, { method, body: method === 'GET' ? undefined : {} });
        assert.equal(status, 401, `${method} ${path}`);
      }
    },
    { auth: refuseAll },
  );
  assert.equal(calls.length, 0);
});

test('a share link needs a label and at least one valid item', async () => {
  const { pool, calls } = scriptedPool(() => []);
  await withApi(pool, async (call) => {
    const post = (body: unknown) => call('/api/share-links', { method: 'POST', body });
    assert.equal((await post([])).data.error, 'Request body must be a JSON object');
    assert.equal((await post({ projects: [1] })).data.error, 'Label is required');
    assert.equal((await post({ label: 'x' })).data.error, 'Choose at least one item to share');
    assert.equal((await post({ label: 'x', projects: ['1'] })).status, 400);
    assert.equal((await post({ label: 'x', projects: [0] })).status, 400);
    assert.equal(
      (await post({ label: 'x', projects: Array.from({ length: 101 }, (_, i) => i + 1) })).status,
      400,
    );
    assert.equal((await call('/api/share-links/abc/revoke', { method: 'POST' })).status, 400);
  });
  assert.equal(calls.length, 0);
});

test('creating a link returns the token once and stores only its hash', async () => {
  const { pool, calls } = scriptedPool(({ params }) => [
    {
      id: 3,
      label: params[0],
      items: JSON.parse(params[2] as string),
      createdAt: 't',
      revokedAt: null,
    },
  ]);
  await withApi(pool, async (call) => {
    const { status, data } = await call('/api/share-links', {
      method: 'POST',
      body: { label: ' Resume ', projects: [2, 2, 5] },
    });
    assert.equal(status, 201);
    const token = data.token as string;
    assert.match(token, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(data.shareLink, {
      id: 3,
      label: 'Resume',
      counts: { careers: 0, projects: 2, educations: 0, certifications: 0 },
      createdAt: 't',
      revokedAt: null,
    });
    const insert = calls[0];
    assert.equal(insert?.params[1], createHash('sha256').update(token).digest('hex'));
    assert.ok(!JSON.stringify(insert?.params).includes(token));
  });
});
