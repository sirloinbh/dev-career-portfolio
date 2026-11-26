import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { apiKey, useApiQuery } from './lib/query';

// An entity list on the shared query layer (#152): its GET path and how to take the rows out of the answer. The list
// screen, the Edit screen and the cover letter screens use the same key, so they share one request and one cache entry.

/** An entity list: `path` is GET-ed, `rows` takes the rows out of the answer (`{ careers: [...] }`). */
export type ListQuery<Row> = { path: string; rows: (body: unknown) => Row[] };

/** A ListQuery for an answer of type `Body`: `listQuery('/api/careers', (body: { careers: Career[] }) => body.careers)`. */
export function listQuery<Body, Row>(path: string, rows: (body: Body) => Row[]): ListQuery<Row> {
  return { path, rows: rows as (body: unknown) => Row[] };
}

/** Loads a list. `rows` is undefined until the first answer; after a failed refetch it keeps the last rows. */
export function useListQuery<Row>(list: ListQuery<Row>, options: { enabled?: boolean } = {}) {
  const query = useApiQuery<unknown>(apiKey(list.path), list.path, options);
  const { data } = query;
  const rows = useMemo(() => (data === undefined ? undefined : list.rows(data)), [data, list]);
  return { query, rows };
}

/** Marks a list stale and refetches it where it is shown, so the next screen does not show the rows from before a write. */
export function useRefreshList(path: string) {
  const client = useQueryClient();
  return useCallback(() => client.invalidateQueries({ queryKey: apiKey(path) }), [client, path]);
}

/**
 * The values already used in one field of a list (#247), most used first, for a Combobox to suggest. Empty until the
 * list has loaded, so the field is a plain text field until then. Spaces and letter case do not make a new value.
 */
export function useKnownValues<Row>(
  list: ListQuery<Row>,
  pick: (row: Row) => string | null | undefined,
) {
  const { rows } = useListQuery(list);
  return useMemo(() => knownValues(rows ?? [], pick), [rows, pick]);
}

export function knownValues<Row>(
  rows: readonly Row[],
  pick: (row: Row) => string | null | undefined,
) {
  const counts = new Map<string, { text: string; count: number }>();
  for (const row of rows) {
    const text = pick(row)?.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    const seen = counts.get(key);
    if (seen) seen.count += 1;
    else counts.set(key, { text, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
    .map((v) => v.text);
}
