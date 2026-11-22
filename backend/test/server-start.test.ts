import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { test } from 'node:test';

import { createPool } from '../src/standard/db.js';

// A TCP listener that accepts connections and never answers: what a frozen database looks like to pg.
const blackHole = () =>
  new Promise<net.Server>((resolve) => {
    const server = net.createServer(() => undefined);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });

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

test('PORT that is not a port number exits with a clear message', async () => {
  const { code, output } = await run(
    { NODE_ENV: 'development', DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x', PORT: 'abc' },
    () => undefined,
  );
  assert.equal(code, 1);
  assert.match(output, /PORT must be a whole number from 1 to 65535/);
});

test('a database that never answers gives a 503 health check, and shutdown stops at its deadline', async () => {
  const db = await blackHole();
  const dbPort = (db.address() as net.AddressInfo).port;
  const started = Date.now();
  let health: Promise<number> | undefined;
  const { code, output } = await run(
    {
      NODE_ENV: 'development',
      DATABASE_URL: `postgres://u:p@127.0.0.1:${dbPort}/x`,
      PORT: '3922',
      HOST: '127.0.0.1',
      SHUTDOWN_TIMEOUT_MS: '300',
    },
    (text, stop) => {
      if (!health && text.includes('API http://')) {
        health = fetch('http://127.0.0.1:3922/api/health').then(
          (res) => res.status,
          () => 0,
        );
        // The request is in flight (the pool is still connecting), so a graceful close would wait for it.
        setTimeout(stop, 200);
      }
    },
  );
  db.close();
  assert.equal(code, 1);
  assert.match(output, /Shutdown deadline reached/);
  assert.ok(Date.now() - started < 4_000, 'the deadline cut the wait');
  await health;
});

test('the pool gives up on a database that never answers with a 503', async () => {
  const db = await blackHole();
  const dbPort = (db.address() as net.AddressInfo).port;
  let status = 0;
  let stopped = false;
  await run(
    {
      NODE_ENV: 'development',
      DATABASE_URL: `postgres://u:p@127.0.0.1:${dbPort}/x`,
      PORT: '3923',
      HOST: '127.0.0.1',
    },
    (text, stop) => {
      if (!stopped && text.includes('API http://')) {
        stopped = true;
        void fetch('http://127.0.0.1:3923/api/health')
          .then((res) => {
            status = res.status;
          })
          .finally(stop);
      }
    },
  );
  db.close();
  assert.equal(status, 503);
});
