import type { Express } from 'express';
import express from 'express';
import type { Pool } from 'pg';
import { z } from 'zod/v4';

import { HttpError } from '../standard/http.js';

// Export and import of every record as one JSON file (#222). The format is in docs/data-format.md.

export const exportFormat = 'dev-career-portfolio-export';
export const exportVersion = 1;
export const importPath = '/api/data/import';

// Every table that holds the user's records, in an order where a table comes after the tables it points
// to (projects.career_id -> careers, project_skills -> projects and skills, cover_letter_questions, interviews, application_status_history and application_projects -> applications and projects). A new
// table must be added here; the integration test fails until it is (or until it is listed as skipped).
export const dataTables = [
  { name: 'app_settings', order: 'key', identity: false },
  { name: 'educations', order: 'id', identity: true },
  { name: 'careers', order: 'id', identity: true },
  { name: 'projects', order: 'id', identity: true },
  { name: 'skills', order: 'id', identity: true },
  { name: 'certifications', order: 'id', identity: true },
  { name: 'applications', order: 'id', identity: true },
  { name: 'interviews', order: 'id', identity: true },
  { name: 'cover_letter_questions', order: 'id', identity: true },
  { name: 'application_status_history', order: 'id', identity: true },
  { name: 'project_skills', order: 'project_id, skill_id', identity: false },
  { name: 'application_projects', order: 'application_id, project_id', identity: false },
  // After certifications and projects. Its bytes travel as base64 text (#227, see binaryColumns).
  { name: 'attachments', order: 'id', identity: true },
] as const;

// bytea columns. to_jsonb would write them as "\\x..." hex; the file carries base64 instead, which is the common
// text form for bytes and a third smaller.
const binaryColumns: Record<string, string> = { attachments: 'data' };

// Tables that are not records of the user: the audit log is history of tool calls, and
// schema_migrations belongs to the migration runner. Neither is exported or replaced.
export const skippedTables = ['audit_log', 'schema_migrations'] as const;

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const row = z.record(z.string(), z.union([cell, z.array(cell)]), {
  error: 'Every row must be an object',
});
const rows = z.array(row, { error: 'Every table must be a list of rows' });

const tableShape = Object.fromEntries(dataTables.map((table) => [table.name, rows]));

export const importFile = z.object(
  {
    format: z.literal(exportFormat, { error: 'This file is not a Dev Career Portfolio export' }),
    version: z.literal(exportVersion, {
      error: `Unsupported export version: this app reads version ${String(exportVersion)}`,
    }),
    exportedAt: z.string({ error: 'The file has no export date' }),
    tables: z.strictObject(tableShape, {
      error: 'The file has a table this app does not know, or has no tables',
    }),
  },
  { error: 'This file is not a Dev Career Portfolio export' },
);

type Rows = Record<string, unknown>[];

async function exportTables(pool: Pool) {
  const client = await pool.connect();
  try {
    // One snapshot for every table, so the file never mixes two moments.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const tables: Record<string, Rows> = {};
    for (const table of dataTables) {
      const binary = binaryColumns[table.name];
      const record = binary
        ? `to_jsonb(t) || jsonb_build_object('${binary}', encode(t.${binary}, 'base64'))`
        : 'to_jsonb(t)';
      const { rows: result } = await client.query<{ rows: Rows }>(
        `SELECT coalesce(jsonb_agg(${record} ORDER BY ${table.order}), '[]'::jsonb) AS rows
         FROM ${table.name} t`,
      );
      tables[table.name] = result[0]?.rows ?? [];
    }
    await client.query('COMMIT');
    return tables;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Refuses a table whose rows do not have exactly the columns the database has. */
async function checkColumns(pool: Pool, tables: Record<string, Rows>) {
  const { rows: columns } = await pool.query<{ table: string; column: string }>(
    `SELECT table_name AS "table", column_name AS "column"
     FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name::text = ANY($1::text[])`,
    [dataTables.map((table) => table.name)],
  );
  const known = new Map<string, Set<string>>();
  for (const { table, column } of columns) {
    known.set(table, (known.get(table) ?? new Set()).add(column));
  }
  for (const table of dataTables) {
    const expected = known.get(table.name) ?? new Set<string>();
    (tables[table.name] ?? []).forEach((record, index) => {
      for (const column of Object.keys(record)) {
        if (!expected.has(column)) {
          throw new HttpError(400, `Table ${table.name}: unknown column ${column}`);
        }
      }
      for (const column of expected) {
        if (!(column in record)) {
          throw new HttpError(
            400,
            `Table ${table.name}, row ${String(index + 1)}: missing column ${column}`,
          );
        }
      }
    });
  }
}

const base64Text = /^[A-Za-z0-9+/]*={0,2}$/;

/** Turns a bytea column's base64 text into the hex form jsonb_populate_recordset reads. */
function fromBase64(table: string, records: Rows): Rows {
  const column = binaryColumns[table];
  if (!column) return records;
  return records.map((record, index) => {
    const value = record[column];
    // Base64 text has a length that is a multiple of 4 (padded); Buffer.from alone would skip bad characters.
    if (typeof value !== 'string' || value.length % 4 !== 0 || !base64Text.test(value)) {
      throw new HttpError(
        400,
        `Table ${table}, row ${String(index + 1)}: ${column} must be base64 text`,
      );
    }
    return { ...record, [column]: `\\x${Buffer.from(value, 'base64').toString('hex')}` };
  });
}

async function replaceAll(pool: Pool, tables: Record<string, Rows>) {
  const client = await pool.connect();
  let current = '';
  try {
    await client.query('BEGIN');
    // Replace, never merge: the tables are emptied first, and the ids restart from the file's own.
    await client.query(
      `TRUNCATE ${dataTables.map((table) => table.name).join(', ')} RESTART IDENTITY`,
    );
    const imported: Record<string, number> = {};
    for (const table of dataTables) {
      current = table.name;
      const records = fromBase64(table.name, tables[table.name] ?? []);
      imported[table.name] = records.length;
      if (records.length > 0) {
        // jsonb_populate_recordset turns each JSON value into the column's own type, and the
        // table's constraints decide whether the row is accepted.
        await client.query(
          `INSERT INTO ${table.name} OVERRIDING SYSTEM VALUE
           SELECT * FROM jsonb_populate_recordset(null::${table.name}, $1::jsonb)`,
          [JSON.stringify(records)],
        );
      }
      if (table.identity) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('${table.name}', 'id'),
                         coalesce(max(id), 1), max(id) IS NOT NULL) FROM ${table.name}`,
        );
      }
    }
    await client.query('COMMIT');
    return imported;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    const { code, constraint } = error as { code?: unknown; constraint?: unknown };
    // Class 22 (bad value) and 23 (constraint) come from the file's data, not from the server.
    if (typeof code === 'string' && (code.startsWith('22') || code.startsWith('23'))) {
      const detail = typeof constraint === 'string' ? ` (${constraint})` : '';
      throw new HttpError(400, `Table ${current} has a row the database refuses${detail}`);
    }
    throw error;
  } finally {
    client.release();
  }
}

export function registerDataTransferRoutes(app: Express, pool: Pool) {
  app.get('/api/data/export', async (_req, res) => {
    const tables = await exportTables(pool);
    res.json({
      format: exportFormat,
      version: exportVersion,
      exportedAt: new Date().toISOString(),
      tables,
    });
  });

  // A whole export is bigger than the 256 kB every other route accepts, so this route has its own
  // limit. app.ts leaves this path out of the shared parser, and the sign-in check runs before this.
  app.post(importPath, express.json({ limit: '100mb' }), async (req, res) => {
    const file = importFile.parse(req.body);
    const tables = file.tables as Record<string, Rows>;
    await checkColumns(pool, tables);
    res.json({ imported: await replaceAll(pool, tables) });
  });
}
