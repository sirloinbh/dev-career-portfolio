import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Pool } from 'pg';

import { cleanFilename, maxAttachmentBytes, sniffType } from '../src/routes/attachments.js';
import { jpeg, pdf, png, upload } from './attachment-upload.js';

// A pool whose owner exists and whose insert echoes the stored values.
function fakePool(inserts: unknown[][]) {
  return {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('SELECT 1')) return { rowCount: 1, rows: [{}] };
      if (sql.startsWith('INSERT')) {
        inserts.push(params);
        return { rowCount: 1, rows: [{ id: 1, filename: params[1], contentType: params[2] }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    },
  } as unknown as Pool;
}

test('the type comes from the first bytes: PDF, PNG and JPEG only', () => {
  assert.equal(sniffType(pdf), 'application/pdf');
  assert.equal(sniffType(png), 'image/png');
  assert.equal(sniffType(jpeg), 'image/jpeg');
  assert.equal(sniffType(Buffer.from('MZ executable')), undefined);
  assert.equal(sniffType(Buffer.alloc(0)), undefined);
});

test('a file name loses folders and control characters and is capped', () => {
  assert.equal(cleanFilename('..\\..\\etc/passwd'), 'passwd');
  assert.equal(cleanFilename('a\u0000b\n.pdf'), 'ab.pdf');
  assert.equal(cleanFilename('   '), 'file');
  assert.equal(Array.from(cleanFilename('가'.repeat(300))).length, 200);
});

test('an upload is stored with the sniffed type and a Korean name intact', async () => {
  const inserts: unknown[][] = [];
  const { status, data } = await upload(fakePool(inserts), '/api/certifications/3/attachments', {
    name: '정보처리기사.pdf',
    bytes: pdf,
  });
  assert.equal(status, 201);
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0]?.slice(0, 4), [3, '정보처리기사.pdf', 'application/pdf', pdf.length]);
  assert.equal((data.attachment as { contentType: string }).contentType, 'application/pdf');
});

test('a wrong type is refused even when the name says PDF', async () => {
  const inserts: unknown[][] = [];
  const { status, data } = await upload(fakePool(inserts), '/api/projects/3/attachments', {
    name: 'fake.pdf',
    bytes: Buffer.from('MZ not a pdf'),
  });
  assert.equal(status, 400);
  assert.equal(data.error, 'File must be a PDF, PNG or JPEG');
  assert.equal(inserts.length, 0);
});

test('a file over 5 MB is refused and nothing is stored', async () => {
  const inserts: unknown[][] = [];
  const big = Buffer.concat([pdf, Buffer.alloc(maxAttachmentBytes)]);
  const { status, data } = await upload(fakePool(inserts), '/api/projects/3/attachments', {
    name: 'big.pdf',
    bytes: big,
  });
  assert.equal(status, 400);
  assert.equal(data.error, 'File must be at most 5 MB');
  assert.equal(inserts.length, 0);
});

test('a request without the file field is refused', async () => {
  const inserts: unknown[][] = [];
  const { status } = await upload(fakePool(inserts), '/api/projects/3/attachments', undefined);
  assert.equal(status, 400);
  const wrong = await upload(fakePool(inserts), '/api/projects/3/attachments', {
    name: 'a.pdf',
    bytes: pdf,
    field: 'document',
  });
  assert.equal(wrong.status, 400);
  assert.equal(inserts.length, 0);
});

test('a bad id is refused before any query runs', async () => {
  const refusing = {
    query: async () => {
      throw new Error('validation should have stopped this request');
    },
  } as unknown as Pool;
  const { status } = await upload(refusing, '/api/projects/abc/attachments', {
    name: 'a.pdf',
    bytes: pdf,
  });
  assert.equal(status, 400);
});
