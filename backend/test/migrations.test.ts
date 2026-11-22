import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checksum,
  migrate,
  type MigrationDb,
  migrationStatus,
  readMigrations,
} from '../src/standard/migrations.js';

// A tiny in-memory stand-in for the one connection the runner uses: it records the schema_migrations rows and the SQL run.
function fakeDb(
  history: { name: string; checksum: string }[] = [],
  hasHistory = history.length > 0,
) {
  const ran: string[] = [];
  const db = {
    query: async (text: string, values?: unknown[]) => {
      if (text.includes('to_regclass')) return { rows: [{ found: hasHistory }] };
      if (text.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
        hasHistory = true;
        return { rows: [] };
      }
      if (text.startsWith('SELECT name, checksum')) return { rows: [...history] };
      if (text.startsWith('INSERT INTO schema_migrations')) {
        history.push({ name: String(values?.[0]), checksum: String(values?.[1]) });
        return { rows: [] };
      }
      ran.push(text);
      return { rows: [] };
    },
  } as unknown as MigrationDb;
  return { db, ran, history };
}

const file = (name: string, sql: string) => ({ name, sql, checksum: checksum(sql) });

test('the runner applies pending files in order and records each one', async () => {
  const { db, ran, history } = fakeDb();
  const applied = await migrate(
    db,
    [file('001_a.sql', 'SELECT 1'), file('002_b.sql', 'SELECT 2')],
    1,
  );
  assert.deepEqual(applied, ['001_a.sql', '002_b.sql']);
  assert.deepEqual(
    history.map((row) => row.name),
    ['001_a.sql', '002_b.sql'],
  );
  assert.ok(ran.includes('SELECT 1') && ran.includes('SELECT 2'));
});

test('an applied file is skipped on the next run', async () => {
  const a = file('001_a.sql', 'SELECT 1');
  const { db, ran } = fakeDb([{ name: a.name, checksum: a.checksum }]);
  const applied = await migrate(db, [a, file('002_b.sql', 'SELECT 2')], 1);
  assert.deepEqual(applied, ['002_b.sql']);
  assert.ok(!ran.includes('SELECT 1'));
});

test('a changed applied file is refused with its name', async () => {
  const { db } = fakeDb([{ name: '001_a.sql', checksum: checksum('SELECT 1') }]);
  await assert.rejects(
    migrate(db, [file('001_a.sql', 'SELECT 1 -- edited')], 1),
    /An applied migration file was changed: 001_a\.sql/,
  );
});

test('--status reports pending files without changing the database', async () => {
  const a = file('001_a.sql', 'SELECT 1');
  const { db, ran, history } = fakeDb([{ name: a.name, checksum: a.checksum }]);
  const status = await migrationStatus(db, [a, file('002_b.sql', 'SELECT 2')]);
  assert.deepEqual(
    status.pending.map((f) => f.name),
    ['002_b.sql'],
  );
  assert.deepEqual(status.errors, []);
  assert.equal(history.length, 1);
  assert.deepEqual(ran, []);
});

test('a database without history reports every file as pending', async () => {
  const { db } = fakeDb();
  const status = await migrationStatus(db, [file('001_a.sql', 'SELECT 1')]);
  assert.equal(status.pending.length, 1);
});

test('the repository migrations load: numbered, unique, runnable in a transaction', async () => {
  const dir = fileURLToPath(new URL('../../database/migrations/', import.meta.url));
  const files = await readMigrations(dir);
  assert.ok(files.length >= 9);
  assert.equal(files[0]?.name, '001_initial.sql');
});

test('a badly named migration file is refused', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'migrations-'));
  await writeFile(join(dir, 'init.sql'), 'SELECT 1');
  await assert.rejects(readMigrations(dir), /must look like NNN_name\.sql/);
});
