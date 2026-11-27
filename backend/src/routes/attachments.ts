import type { Express, NextFunction, Request, Response } from 'express';
import multer from 'multer';
import type { Pool } from 'pg';

import { HttpError, parseId } from '../standard/http.js';

// Files attached to a certification or a project (#227). The bytes are stored in the database (bytea).

export const maxAttachmentBytes = 5 * 1024 * 1024;

type AttachmentType = 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * The type comes from the file's first bytes, never from the name or the type the browser sent, so a renamed file
 * cannot slip in and the stored type is always one of the four the download is allowed to serve.
 */
export function sniffType(bytes: Buffer): AttachmentType | undefined {
  if (bytes.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg';
  // WebP is a RIFF container: "RIFF", a 4-byte size, then "WEBP".
  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return undefined;
}

/** The name without folders or control characters, at most 200 characters. */
export function cleanFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return Array.from(cleaned).slice(0, 200).join('') || 'file';
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxAttachmentBytes, files: 1, fields: 0, parts: 2 },
  // Names are UTF-8 (Korean file names); multer reads them as latin1 unless told.
  defParamCharset: 'utf8',
}).single('file');

/** Runs multer and turns its errors into the API's own 400s. */
function receiveFile(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(
        new HttpError(
          400,
          error.code === 'LIMIT_FILE_SIZE'
            ? 'File must be at most 5 MB'
            : 'Send one file in the "file" field',
        ),
      );
    } else {
      next(error);
    }
  });
}

type Owner = { path: string; table: 'certifications' | 'projects'; column: string; label: string };

const owners: Owner[] = [
  {
    path: '/api/certifications/:id/attachments',
    table: 'certifications',
    column: 'certification_id',
    label: 'Certification',
  },
  {
    path: '/api/projects/:id/attachments',
    table: 'projects',
    column: 'project_id',
    label: 'Project',
  },
];

const columns = `id, filename, content_type AS "contentType", size_bytes AS "sizeBytes",
  created_at AS "createdAt"`;

const notFoundError = () => new HttpError(404, 'Attachment not found');

/** RFC 5987 form, so a Korean name survives in the header. */
const contentDisposition = (filename: string) =>
  `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(filename).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )}`;

export function registerAttachmentRoutes(app: Express, pool: Pool) {
  for (const owner of owners) {
    const ownerExists = async (id: number) => {
      const { rowCount } = await pool.query(`SELECT 1 FROM ${owner.table} WHERE id = $1`, [id]);
      if (rowCount === 0) throw new HttpError(404, `${owner.label} not found`);
    };

    app.get(owner.path, async (req, res) => {
      const id = parseId(req.params.id, owner.label.toLowerCase());
      await ownerExists(id);
      const { rows } = await pool.query(
        `SELECT ${columns} FROM attachments WHERE ${owner.column} = $1 ORDER BY id`,
        [id],
      );
      res.json({ attachments: rows });
    });

    app.post(owner.path, receiveFile, async (req, res) => {
      const id = parseId(req.params.id, owner.label.toLowerCase());
      const file = req.file;
      if (!file || file.size === 0) throw new HttpError(400, 'Choose a file to upload');
      const type = sniffType(file.buffer);
      if (!type) throw new HttpError(400, 'File must be a PDF, PNG, JPEG or WebP');
      await ownerExists(id);
      const { rows } = await pool.query(
        `INSERT INTO attachments (${owner.column}, filename, content_type, size_bytes, data)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${columns}`,
        [id, cleanFilename(file.originalname), type, file.size, file.buffer],
      );
      res.status(201).json({ attachment: rows[0] });
    });
  }

  app.get('/api/attachments/:id', async (req, res) => {
    const id = parseId(req.params.id, 'attachment');
    const { rows } = await pool.query<{ filename: string; contentType: string; data: Buffer }>(
      `SELECT filename, content_type AS "contentType", data FROM attachments WHERE id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) throw notFoundError();
    res
      .status(200)
      .set({
        'Content-Type': row.contentType,
        'Content-Length': String(row.data.length),
        'Content-Disposition': contentDisposition(row.filename),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      })
      .end(row.data);
  });

  app.delete('/api/attachments/:id', async (req, res) => {
    const id = parseId(req.params.id, 'attachment');
    const { rowCount } = await pool.query('DELETE FROM attachments WHERE id = $1', [id]);
    if (rowCount === 0) throw notFoundError();
    res.status(204).end();
  });
}
