// Settings (#222): reading an export file and naming the download. The screen is in settings.tsx; the
// file format is in docs/data-format.md.

export type ExportSummary = {
  exportedAt: string;
  /** Rows per table, in the file's own order. */
  counts: [table: string, rows: number][];
  total: number;
};

/**
 * What the file says it holds, or null when it does not look like an export. Only a quick look so the
 * confirmation can say how much will be replaced; the server checks the whole file before it changes anything.
 */
export function summarizeExport(file: unknown): ExportSummary | null {
  if (typeof file !== 'object' || file === null) return null;
  const { format, exportedAt, tables } = file as Record<string, unknown>;
  if (format !== 'dev-career-portfolio-export') return null;
  if (typeof exportedAt !== 'string') return null;
  if (typeof tables !== 'object' || tables === null || Array.isArray(tables)) return null;
  const counts: ExportSummary['counts'] = [];
  for (const [table, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) return null;
    counts.push([table, rows.length]);
  }
  return { exportedAt, counts, total: counts.reduce((sum, [, rows]) => sum + rows, 0) };
}

/** "dev-career-portfolio-2026-11-27.json" */
export const exportFileName = (today: string) => `dev-career-portfolio-${today}.json`;

/** "records" or "record", for a count. */
export const recordsText = (count: number) =>
  `${String(count)} ${count === 1 ? 'record' : 'records'}`;

/** Gives `text` to the browser as a file to save. */
export function downloadJson(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
