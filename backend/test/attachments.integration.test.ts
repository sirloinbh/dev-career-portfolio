import assert from 'node:assert/strict';
import { test } from 'node:test';

import { Pool } from 'pg';

import { createApp } from '../src/app.js';
import { jpeg, pdf, png, upload, webp } from './attachment-upload.js';
import { listenForFetch, lockPortfolio, testDatabaseUrl, withApi } from './helpers.js';

const url = testDatabaseUrl();

// Requires career_test with database/migrations applied. Skipped (not passed) without it.
test(
  'attachments are uploaded, listed, downloaded and deleted, and go with their item (#227)',
  { skip: !url },
  async (t) => {
    await lockPortfolio(t);
    const pool = new Pool({ connectionString: url });
    t.after(() => pool.end());
    await pool.query('DELETE FROM certifications');
    await pool.query('DELETE FROM projects');
    const { rows: cert } = await pool.query<{ id: number }>(
      `INSERT INTO certifications (name, issuer, acquired_date) VALUES ('정보처리기사', '한국산업인력공단', '2021-06-09') RETURNING id`,
    );
    const { rows: proj } = await pool.query<{ id: number }>(
      `INSERT INTO projects (name, start_date) VALUES ('포트폴리오', '2024-01-02') RETURNING id`,
    );
    const certId = cert[0]?.id ?? 0;
    const projId = proj[0]?.id ?? 0;

    const first = await upload(pool, `/api/certifications/${String(certId)}/attachments`, {
      name: '합격증.pdf',
      bytes: pdf,
    });
    assert.equal(first.status, 201);
    const second = await upload(pool, `/api/projects/${String(projId)}/attachments`, {
      name: 'shot.png',
      bytes: png,
    });
    assert.equal(second.status, 201);
    await upload(pool, `/api/projects/${String(projId)}/attachments`, {
      name: 'a.jpg',
      bytes: jpeg,
    });
    const webpUpload = await upload(pool, `/api/projects/${String(projId)}/attachments`, {
      name: 'phone.webp',
      bytes: webp,
    });
    assert.equal(webpUpload.status, 201);
    const webpId = (webpUpload.data.attachment as { id: number }).id;
    const firstId = (first.data.attachment as { id: number }).id;

    // A missing owner is a 404 and stores nothing.
    const missing = await upload(pool, '/api/certifications/999999/attachments', {
      name: 'x.pdf',
      bytes: pdf,
    });
    assert.equal(missing.status, 404);

    await withApi(pool, async (call) => {
      const list = await call(`/api/projects/${String(projId)}/attachments`);
      assert.equal(list.status, 200);
      assert.deepEqual(
        (list.data.attachments as { filename: string; sizeBytes: number }[]).map((a) => [
          a.filename,
          a.sizeBytes,
        ]),
        [
          ['shot.png', png.length],
          ['a.jpg', jpeg.length],
          ['phone.webp', webp.length],
        ],
      );
      assert.equal((await call('/api/projects/999999/attachments')).status, 404);
    });

    // Download returns the exact bytes with a safe header set.
    const { server, port } = await listenForFetch(() => createApp(pool).listen(0, '127.0.0.1'));
    try {
      const response = await fetch(
        `http://127.0.0.1:${String(port)}/api/attachments/${String(firstId)}`,
      );
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.match(response.headers.get('content-disposition') ?? '', /^attachment;/);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);

      // The WebP is stored and served with its own type (the 019 CHECK allows it).
      const webpResponse = await fetch(
        `http://127.0.0.1:${String(port)}/api/attachments/${String(webpId)}`,
      );
      assert.equal(webpResponse.headers.get('content-type'), 'image/webp');
      assert.deepEqual(Buffer.from(await webpResponse.arrayBuffer()), webp);
    } finally {
      server.close();
    }

    await withApi(pool, async (call) => {
      assert.equal((await call('/api/attachments/999999')).status, 404);
      assert.equal(
        (await call(`/api/attachments/${String(firstId)}`, { method: 'DELETE' })).status,
        204,
      );
      assert.equal(
        (await call(`/api/attachments/${String(firstId)}`, { method: 'DELETE' })).status,
        404,
      );

      // Deleting the project deletes its files.
      assert.equal(
        (await call(`/api/projects/${String(projId)}`, { method: 'DELETE' })).status,
        204,
      );
    });
    const { rows: left } = await pool.query('SELECT 1 FROM attachments WHERE project_id = $1', [
      projId,
    ]);
    assert.equal(left.length, 0);
    await pool.query('DELETE FROM certifications');
  },
);
