import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

import express from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { createApp } from '../src/app.js';
import { document, operations } from '../src/openapi.js';
import { schemaOf } from '../src/standard/openapi.js';

type Layer = { route?: { path: string; methods: Record<string, boolean> } };

// The app as the server builds it, with no database: routes are only registered, never called, so
// the pool is never used. All routes are registered directly on the app, so the router stack lists them.
function documentedApp() {
  return createApp({} as Pool);
}

function registeredRoutes(app: express.Express) {
  const stack = (app as unknown as { router: { stack: Layer[] } }).router.stack;
  return stack.flatMap((layer) =>
    layer.route
      ? Object.keys(layer.route.methods).map((m) => `${m.toUpperCase()} ${layer.route!.path}`)
      : [],
  );
}

// Routes are only registered here, never called, so no database is needed.
const app = documentedApp;

test('docs/openapi.json is up to date with the operation table', async () => {
  const committed = JSON.parse(
    await readFile(new URL('../../docs/openapi.json', import.meta.url), 'utf8'),
  ) as unknown;
  assert.deepEqual(
    committed,
    JSON.parse(JSON.stringify(document)),
    'run `npm run openapi -w backend` and commit',
  );
});

test('the operation table and the registered routes are the same set', () => {
  assert.deepEqual(Object.keys(operations).sort(), [...registeredRoutes(app())].sort());
});

test('API paths start with /api and use lowercase words joined by hyphens', () => {
  const routes = registeredRoutes(app());
  assert.ok(routes.includes('GET /api/health'));
  for (const route of routes)
    assert.match(route, /^[A-Z]+ \/api(\/(:\w+|[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+)?))*$/);
});

test('guarded routes document the sign-in, 401 and 429; the public route does not', () => {
  const paths = document.paths as Record<
    string,
    Record<string, { security?: unknown[]; responses: Record<string, unknown> }>
  >;
  assert.deepEqual(paths['/api/health']!.get!.security, []);
  assert.ok(!('401' in paths['/api/health']!.get!.responses));
  assert.ok('429' in paths['/api/me']!.get!.responses);
});

test('a type JSON Schema cannot express fails instead of being skipped', () => {
  assert.throws(() => schemaOf(z.date()), /Date cannot be represented/);
});

// A route file that throws `new HttpError(<status>` must have an operation under its own path that lists the status, so
// a client generated from the document knows every answer (#190). The question list lives under /api/applications.
const pathOf: Record<string, string> = {
  'cover-letter-questions.ts': '/api/applications/:id/questions',
};

test('every status a route file throws is listed by an operation of that route', async () => {
  const dir = new URL('../src/routes/', import.meta.url);
  for (const file of await readdir(dir)) {
    if (file === 'shared.ts') continue;
    const source = await readFile(new URL(file, dir), 'utf8');
    const prefix = pathOf[file] ?? `/api/${file.replace(/\.ts$/, '')}`;
    const documented = new Set(
      Object.entries(operations)
        .filter(([route]) => route.split(' ')[1]!.startsWith(prefix))
        .flatMap(([, operation]) => operation.status),
    );
    const thrown = [...source.matchAll(/HttpError\(\s*(\d{3})/g)].map((match) => Number(match[1]));
    for (const status of thrown) {
      assert.ok(
        documented.has(status),
        `${file} throws ${String(status)} but no operation lists it`,
      );
    }
  }
});

test('a duplicate skill name is documented as 409 on both write operations', () => {
  assert.ok(operations['POST /api/skills']!.status.includes(409));
  assert.ok(operations['PUT /api/skills/:id']!.status.includes(409));
});
