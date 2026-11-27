import { once } from 'node:events';

import type { Pool } from 'pg';

import { createApp } from '../src/app.js';
import { listenForFetch } from './helpers.js';

export const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from([0, 255, 128])]);
export const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(8),
]);
export const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x1a, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
  Buffer.alloc(8),
]);
export const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);

/** Sends one multipart upload (or none) to a started app and returns the status and JSON. */
export async function upload(
  pool: Pool,
  path: string,
  file: { name: string; bytes: Buffer; field?: string } | undefined,
) {
  const { server, port } = await listenForFetch(() => createApp(pool).listen(0, '127.0.0.1'));
  try {
    const form = new FormData();
    if (file) {
      form.append(file.field ?? 'file', new Blob([new Uint8Array(file.bytes)]), file.name);
    } else {
      form.append('other', 'x');
    }
    const response = await fetch(`http://127.0.0.1:${String(port)}${path}`, {
      method: 'POST',
      body: form,
    });
    const text = await response.text();
    return {
      status: response.status,
      data: (text ? JSON.parse(text) : {}) as Record<string, unknown>,
    };
  } finally {
    server.close();
    await once(server, 'close');
  }
}
