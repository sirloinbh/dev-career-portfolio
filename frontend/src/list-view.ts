// Search, filter, and sort for the resume item lists (#238). This file holds the pure rules; list-toolbar.tsx draws the
// controls. Each section describes its own fields with a ListTools, and the choices live in the URL query.

type ListFilterOption<Row> = {
  value: string;
  label: string;
  matches: (row: Row) => boolean;
};
type ListSortOption<Row> = {
  value: string;
  label: string;
  /** Left out for the first option when it is the order the API already sends. */
  compare?: (a: Row, b: Row) => number;
};

/** What one section can search, filter, and sort by. The first sort option is the default. */
export type ListTools<Row> = {
  /** The text a search looks in. */
  searchText: (row: Row) => readonly (string | null | undefined)[];
  /** One filter: its label and the choices for the rows now loaded (the "All" choice is added by the toolbar). */
  filter?: { label: string; options: (rows: readonly Row[]) => ListFilterOption<Row>[] };
  sorts: readonly ListSortOption<Row>[];
};

/** What the person chose; every field is '' when nothing is chosen. */
export type ListView = { q: string; filter: string; sort: string };

export const emptyListView: ListView = { q: '', filter: '', sort: '' };

/** Same letters whatever the keyboard typed: composed Korean, lower case, single spaces. */
export function normalizeSearch(text: string) {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A row matches when every word of the search is found in one of its texts. */
export function matchesSearch<Row>(row: Row, tools: ListTools<Row>, q: string) {
  const words = normalizeSearch(q).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeSearch(tools.searchText(row).filter(Boolean).join(' '));
  return words.every((word) => haystack.includes(word));
}

/** The rows that pass the search and the filter, in the chosen order. An unknown filter or sort is ignored. */
export function applyListView<Row>(rows: readonly Row[], tools: ListTools<Row>, view: ListView) {
  const option = tools.filter?.options(rows).find((o) => o.value === view.filter);
  const sort = tools.sorts.find((s) => s.value === view.sort) ?? tools.sorts[0];
  const kept = rows.filter(
    (row) => matchesSearch(row, tools, view.q) && (option ? option.matches(row) : true),
  );
  // Array.prototype.sort is stable, so equal rows keep the API's order.
  return sort?.compare ? [...kept].sort(sort.compare) : kept;
}

/** True when the view hides or reorders nothing, so a "Clear" button is not needed. */
export const isDefaultView = (view: ListView) => !view.q.trim() && !view.filter && !view.sort;

/** Text order that also works for Korean. */
export const byText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').localeCompare(b ?? '');

/** Dates are YYYY-MM-DD, so text order is date order; an empty date (still running) counts as the latest. */
export const byDate = (a: string | null, b: string | null) =>
  (a ?? '9999-12-31').localeCompare(b ?? '9999-12-31');

export const toViewParams = (view: ListView, current: URLSearchParams) => {
  const next = new URLSearchParams(current);
  for (const key of ['q', 'filter', 'sort'] as const) {
    if (view[key]) next.set(key, view[key]);
    else next.delete(key);
  }
  return next;
};

export const fromViewParams = (params: URLSearchParams): ListView => ({
  q: params.get('q') ?? '',
  filter: params.get('filter') ?? '',
  sort: params.get('sort') ?? '',
});
