import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';

import { createPool } from '../src/standard/db.js';

const run = (env: Record<string, string>, onOutput: (text: string, stop: () => void) => void) =>
  new Promise<{ code: number | null; output: string }>((resolve) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
      env: { PATH: process.env.PATH ?? '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const stop = () => child.kill('SIGINT');
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      onOutput(output, stop);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('close', (code) => resolve({ code, output }));
  });

test('the server exits with a clear message when DATABASE_URL is missing', async () => {
  const { code, output } = await run({ NODE_ENV: 'development' }, () => undefined);
  assert.equal(code, 1);
  assert.match(output, /DATABASE_URL is required/);
});

test('without AUTH_INTERNAL_URL the server warns that sign-in is off and stops cleanly on SIGINT', async () => {
  let stopped = false;
  const { code, output } = await run(
    {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x',
      PORT: '3921',
      HOST: '127.0.0.1',
    },
    (text, stop) => {
      if (!stopped && text.includes('API http://')) {
        stopped = true;
        stop();
      }
    },
  );
  assert.match(output, /WITHOUT sign-in/);
  assert.equal(code, 0);
});

test('an error event on the pool or on a connection is logged and does not throw', () => {
  const pool = new EventEmitter();
  const logged: string[] = [];
  createPool(pool, (message) => logged.push(message));
  const client = new EventEmitter();
  pool.emit('connect', client);
  assert.doesNotThrow(() => pool.emit('error', new Error('idle client lost')));
  assert.doesNotThrow(() => client.emit('error', new Error('connection lost')));
  assert.deepEqual(logged, ['Database connection failed']);
});
