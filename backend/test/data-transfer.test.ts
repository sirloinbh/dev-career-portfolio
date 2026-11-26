import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { dataTables, exportFormat, exportVersion } from '../src/routes/data.js';
import { withApi } from './helpers.js';

// A file that fails validation must be refused before the database is touched at all.
const refusingPool = {
  query: async () => {
    throw new Error('validation should have stopped this request');
  },
  connect: async () => {
    throw new Error('validation should have stopped this request');
  },
} as unknown as Pool;

const emptyTables = () => Object.fromEntries(dataTables.map((table) => [table.name, []]));
const valid = () => ({
  format: exportFormat,
  version: exportVersion,
  exportedAt: '2026-11-27T00:00:00.000Z',
  tables: emptyTables(),
});

async function expectRefused(body: unknown, message: string | RegExp) {
  await withApi(refusingPool, async (call) => {
    const { status, data } = await call('/api/data/import', { method: 'POST', body });
    assert.equal(status, 400);
    assert.match(String(data.error), message instanceof RegExp ? message : new RegExp(message));
  });
}

test('a file that is not an export, or is the wrong version, is refused', async () => {
  await expectRefused('hello', 'Request body is not valid JSON');
  await expectRefused([], 'not a Dev Career Portfolio export');
  await expectRefused(
    { ...valid(), format: 'something-else' },
    'not a Dev Career Portfolio export',
  );
  await expectRefused({ ...valid(), version: 2 }, 'Unsupported export version');
  await expectRefused({ ...valid(), version: undefined }, 'Unsupported export version');
  await expectRefused({ ...valid(), exportedAt: undefined }, 'no export date');
});

test('a table this app does not know, a table that is not a list, or a row that is not an object is refused', async () => {
  await expectRefused({ ...valid(), tables: undefined }, /table/);
  await expectRefused({ ...valid(), tables: { ...emptyTables(), secrets: [] } }, /does not know/);
  await expectRefused({ ...valid(), tables: { ...emptyTables(), skills: {} } }, /list of rows/);
  await expectRefused({ ...valid(), tables: { ...emptyTables(), skills: ['x'] } }, /object/);
});

test('export format constants name every record table once', () => {
  const names = dataTables.map((table) => table.name);
  assert.equal(new Set(names).size, names.length);
  // A table comes after the tables it points to.
  assert.ok(names.indexOf('careers') < names.indexOf('projects'));
  assert.ok(names.indexOf('applications') < names.indexOf('cover_letter_questions'));
  assert.ok(names.indexOf('applications') < names.indexOf('application_status_history'));
  assert.ok(names.indexOf('projects') < names.indexOf('project_skills'));
  assert.ok(names.indexOf('skills') < names.indexOf('project_skills'));
});
