import { Plus, SearchX } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { Button } from './components/ui/button';
import { EmptyState } from './components/ui/empty-state';
import { SkeletonList } from './components/ui/skeleton';
import { deleteItem } from './delete-item';
import { entryCount } from './entry-count';
import { LoadErrorNotice } from './item-list-page-notice';
import { type ListQuery, useListQuery, useRefreshList } from './list-query';
import { ListToolbar } from './list-toolbar';
import {
  applyListView,
  fromViewParams,
  isDefaultView,
  type ListTools,
  toViewParams,
} from './list-view';
import { PageHeader } from './page-header';

// One list screen for every entity (#145): load, skeleton, error notices, empty state, and delete then focus.

/** The `<ul>` card every entity list uses. `label` names it for screen readers. */
export function ItemUl({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ul
      aria-label={label}
      className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
    >
      {children}
    </ul>
  );
}

export function ItemListPage<Row extends { id: number | string }>({
  list,
  title,
  description,
  noun,
  addLabel,
  addTo,
  empty,
  deleteNoun,
  deleteName,
  removeRow,
  tools,
  renderRows,
}: {
  /** The list's path and rows (a module-level constant from the entity's `*-data.ts`). */
  list: ListQuery<Row>;
  title: string;
  description: string;
  /** The word in "Loading <noun>" and "Could not load <noun>.": "career", "skills". */
  noun: string;
  addLabel: string;
  addTo: string;
  empty: { icon: ReactNode; title: string; description: string };
  /** What a row is, in the delete toast: "career", "skill". */
  deleteNoun: string;
  deleteName: (row: Row) => string;
  removeRow: (row: Row) => Promise<unknown>;
  /** What the toolbar above the list can search, filter, and sort by; without it the list has no toolbar. */
  tools?: ListTools<Row>;
  /** The rows (at least one) with the delete handler for each row's dialog. */
  renderRows: (rows: Row[], onDelete: (row: Row) => Promise<void>) => ReactNode;
}) {
  const { query, rows: loadedRows } = useListQuery(list);
  const refresh = useRefreshList(list.path);
  // Rows deleted on this screen stay hidden, so a failed refetch cannot bring a deleted row back.
  const [deleted, setDeleted] = useState<ReadonlySet<Row['id']>>(() => new Set());
  const allRows = (loadedRows ?? []).filter((row) => !deleted.has(row.id));
  // The search, filter, and sort live in the URL query, so a reload or a shared link keeps them (#238).
  const [params, setParams] = useSearchParams();
  const view = fromViewParams(params);
  const rows = tools ? applyListView(allRows, tools, view) : allRows;
  const hasRows = loadedRows !== undefined;
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a refetch keeps the rows on screen.
  const firstLoad = query.isPending;

  const remove = async (row: Row) => {
    await deleteItem({ remove: () => removeRow(row), noun: deleteNoun, name: deleteName(row) });
    setDeleted((current) => new Set(current).add(row.id));
    void refresh();
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader title={title} description={description} headingRef={heading}>
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? `Loading ${noun}` : ''}
          {hasRows ? entryCount(rows.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={addTo}>
          <Plus aria-hidden />
          {addLabel}
        </Link>
      </Button>
      {tools && allRows.length > 0 ? (
        <ListToolbar
          tools={tools}
          rows={allRows}
          view={view}
          onChange={(next) =>
            setParams((current) => toViewParams(next, current), { replace: true })
          }
        />
      ) : null}
      {firstLoad ? <SkeletonList rows={3} /> : null}
      <LoadErrorNotice
        failed={query.isError ? { error: query.error } : undefined}
        noun={noun}
        hasRows={hasRows}
        onRetry={() => void query.refetch()}
      />
      {hasRows && allRows.length > 0 && rows.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<SearchX />}
          title="No entries match"
          description="Change the search or the filter to see more."
          action={
            isDefaultView(view) ? undefined : (
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setParams((current) => toViewParams({ q: '', filter: '', sort: '' }, current), {
                    replace: true,
                  })
                }
              >
                Clear search and filter
              </Button>
            )
          }
        />
      ) : null}
      {hasRows && allRows.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={empty.icon}
          title={empty.title}
          description={empty.description}
        />
      ) : null}
      {rows.length > 0 ? renderRows(rows, remove) : null}
    </section>
  );
}
