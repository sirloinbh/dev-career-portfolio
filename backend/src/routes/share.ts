import { createHash, randomBytes } from 'node:crypto';

import type { Express } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError, parseId } from '../standard/http.js';
import { objectBodyError, requiredText } from './shared.js';

// Share links (#236). A link opens a read-only page with only the items it names. The decision is in
// docs/decisions/0001-portfolio-sharing-access.md: the whole app is behind the sign-in, and the one public route is
// GET /api/share/:token. The token is random, only its SHA-256 hash is stored, and a revoked link stops working.

const shareKinds = ['careers', 'projects', 'educations', 'certifications'] as const;
type ShareKind = (typeof shareKinds)[number];

const idsError = 'Item ids must be a list of ids';
const idList = z
  .array(
    z.number({ error: idsError }).int(idsError).min(1, idsError).max(999_999_999_999_999, idsError),
    { error: idsError },
  )
  .max(100, 'At most 100 items of one kind can be shared')
  .default([]);

export const shareLinkInput = z
  .object(
    {
      label: requiredText('Label', 100),
      careers: idList,
      projects: idList,
      educations: idList,
      certifications: idList,
    },
    objectBodyError,
  )
  .refine((input) => shareKinds.some((kind) => input[kind].length > 0), {
    error: 'Choose at least one item to share',
    path: ['careers'],
  });

// 32 random bytes as base64url: always 43 characters of this alphabet. Anything else cannot be a token, so it is
// refused before a query runs.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

type LinkRow = {
  id: number;
  label: string;
  items: Partial<Record<ShareKind, number[]>>;
  createdAt: string;
  revokedAt: string | null;
};

const linkColumns = `id, label, items, created_at AS "createdAt", revoked_at AS "revokedAt"`;

function present(row: LinkRow) {
  return {
    id: row.id,
    label: row.label,
    counts: Object.fromEntries(shareKinds.map((kind) => [kind, row.items[kind]?.length ?? 0])),
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

// What a visitor may see: explicit columns only, so a new private column never leaks by accident. Memos, GPA and
// scores stay private.
const publicQueries: Record<ShareKind, string> = {
  careers: `SELECT id, company, department, position, employment_type AS "employmentType",
      start_date AS "startDate", end_date AS "endDate", duties, achievements
    FROM careers WHERE id = ANY($1::bigint[]) ORDER BY start_date DESC, id DESC`,
  projects: `SELECT id, name, organization, start_date AS "startDate", end_date AS "endDate", role, summary,
      contributions, repository_url AS "repositoryUrl", service_url AS "serviceUrl",
      COALESCE((SELECT json_agg(s.name ORDER BY lower(s.name) COLLATE "C", s.id)
                FROM project_skills ps JOIN skills s ON s.id = ps.skill_id
                WHERE ps.project_id = projects.id), '[]'::json) AS "skills"
    FROM projects WHERE id = ANY($1::bigint[]) ORDER BY start_date DESC, id DESC`,
  educations: `SELECT id, school, major, degree, status, start_date AS "startDate", end_date AS "endDate"
    FROM educations WHERE id = ANY($1::bigint[]) ORDER BY start_date DESC, id DESC`,
  certifications: `SELECT id, name, issuer, acquired_date AS "acquiredDate", expiry_date AS "expiryDate"
    FROM certifications WHERE id = ANY($1::bigint[]) ORDER BY acquired_date DESC, id DESC`,
};

const linkNotFound = () => new HttpError(404, 'Share link not found');

/**
 * The public read-only route. app.ts registers it BEFORE the sign-in guard; it is the only route that is. It answers
 * GET only, and the same 404 for a malformed, unknown or revoked token, so a token cannot be probed.
 */
export function registerPublicShareRoutes(app: Express, pool: Pool) {
  app.get('/api/share/:token', async (req, res) => {
    const { token } = req.params;
    if (!TOKEN_PATTERN.test(token)) throw linkNotFound();
    const { rows } = await pool.query<LinkRow>(
      `SELECT ${linkColumns} FROM share_links WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(token)],
    );
    const link = rows[0];
    if (!link) throw linkNotFound();
    const body: Record<string, unknown> = { label: link.label };
    for (const kind of shareKinds) {
      const ids = link.items[kind] ?? [];
      body[kind] = ids.length === 0 ? [] : (await pool.query(publicQueries[kind], [ids])).rows;
    }
    // A shared page is for the people holding the link: keep it out of caches, search engines and referrers.
    res.set({
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    });
    res.json(body);
  });
}

/** Creating, listing and revoking links. Registered after the sign-in guard like every other route. */
export function registerShareLinkRoutes(app: Express, pool: Pool) {
  app.get('/api/share-links', async (_req, res) => {
    const { rows } = await pool.query<LinkRow>(
      `SELECT ${linkColumns} FROM share_links ORDER BY created_at DESC, id DESC`,
    );
    res.json({ shareLinks: rows.map(present) });
  });

  app.post('/api/share-links', async (req, res) => {
    const input = shareLinkInput.parse(req.body);
    const token = randomBytes(32).toString('base64url');
    const items = Object.fromEntries(shareKinds.map((kind) => [kind, [...new Set(input[kind])]]));
    const { rows } = await pool.query<LinkRow>(
      `INSERT INTO share_links (label, token_hash, items) VALUES ($1, $2, $3)
       RETURNING ${linkColumns}`,
      [input.label, hashToken(token), JSON.stringify(items)],
    );
    const [row] = rows;
    // The token is in this answer only; it cannot be read again.
    res.status(201).json({ shareLink: present(row), token });
  });

  app.post('/api/share-links/:id/revoke', async (req, res) => {
    const id = parseId(req.params.id, 'share link');
    const { rows } = await pool.query<LinkRow>(
      `UPDATE share_links SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1
       RETURNING ${linkColumns}`,
      [id],
    );
    if (!rows[0]) throw linkNotFound();
    res.json({ shareLink: present(rows[0]) });
  });
}
