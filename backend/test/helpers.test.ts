import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { test } from 'node:test';

import { fetchBlockedPorts, listenForFetch } from './helpers.js';

// #77: listen(0) can get a port fetch refuses, which failed unrelated tests with "bad port".

const plainServer = () =>
  createServer((_request, response) => response.end('ok')).listen(0, '127.0.0.1');

test('every port in the list is one this Node fetch refuses', async () => {
  // fetch checks the port before connecting, so nothing is sent anywhere.
  for (const port of fetchBlockedPorts) {
    await assert.rejects(fetch(`http://127.0.0.1:${String(port)}/`), (error: Error) => {
      assert.equal((error.cause as Error | undefined)?.message, 'bad port', `port ${String(port)}`);
      return true;
    });
  }
});

test('a blocked port is closed and another one is used', async () => {
  const started: Server[] = [];
  let checks = 0;
  const { server, port } = await listenForFetch(
    () => {
      const next = plainServer();
      started.push(next);
      return next;
    },
    // Treat the first port as blocked, the way 6000 would be.
    () => ++checks === 1,
  );
  try {
    assert.equal(started.length, 2);
    assert.equal(started[0].listening, false);
    assert.equal(server, started[1]);
    const response = await fetch(`http://127.0.0.1:${String(port)}/`);
    assert.equal(await response.text(), 'ok');
  } finally {
    server.close();
  }
});

test('it gives up after the attempts and leaves no server open', async () => {
  const started: Server[] = [];
  await assert.rejects(
    listenForFetch(
      () => {
        const next = plainServer();
        started.push(next);
        return next;
      },
      () => true,
      3,
    ),
    /No port that fetch can reach after 3 attempts/,
  );
  assert.equal(started.length, 3);
  assert.ok(started.every((server) => !server.listening));
});
