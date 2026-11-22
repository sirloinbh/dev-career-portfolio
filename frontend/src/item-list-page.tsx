import { Plus } from 'lucide-react';
import { type ReactNode, useRef } from 'react';
import { Link } from 'react-router';

import { Button } from './components/ui/button';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { deleteItem } from './delete-item';
import { entryCount } from './entry-count';
import { ReloadNotice } from './item-list-page-notice';
import { errorText } from './lib/use-notice';
import { PageHeader } from './page-header';
import { useReloading } from './use-load';

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
  load,
  title,
  description,
  noun,
  addLabel,
  addTo,
  empty,
  deleteNoun,
  deleteName,
  removeRow,
  renderRows,
}: {
  /** Must not change between renders (a module-level function). */
  load: () => Promise<Row[]>;
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
  /** The rows (at least one) with the delete handler for each row's dialog. */
  renderRows: (rows: Row[], onDelete: (row: Row) => Promise<void>) => ReactNode;
}) {
  const { loaded, data, reload } = useReloading('all', load);
  const rows = data ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a reload keeps the rows on screen.
  const firstLoad = loaded.state === 'loading' && data === undefined;

  const remove = async (row: Row) => {
    await deleteItem({ remove: () => removeRow(row), noun: deleteNoun, name: deleteName(row) });
    reload((current) => current.filter((item) => item.id !== row.id));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader title={title} description={description} headingRef={heading}>
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? `Loading ${noun}` : ''}
          {data ? entryCount(rows.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={addTo}>
          <Plus aria-hidden />
          {addLabel}
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `Could not load ${noun}. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'error' && data !== undefined ? (
        <ReloadNotice noun={noun} error={loaded.error} onRetry={() => reload()} />
      ) : null}
      {data && rows.length === 0 ? (
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
