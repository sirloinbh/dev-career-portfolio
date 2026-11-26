import { Search } from 'lucide-react';
import { useId } from 'react';

import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { NativeSelect } from './components/ui/native-select';
import { isDefaultView, type ListTools, type ListView } from './list-view';

/** The search box, the filter, and the sort choice above a list (#238). The choices are lifted to the caller. */
export function ListToolbar<Row>({
  tools,
  rows,
  view,
  onChange,
}: {
  tools: ListTools<Row>;
  /** The rows before searching, so a filter can offer only what exists (for example the years). */
  rows: readonly Row[];
  view: ListView;
  onChange: (view: ListView) => void;
}) {
  const id = useId();
  const options = tools.filter?.options(rows) ?? [];
  const sort = tools.sorts.some((s) => s.value === view.sort)
    ? view.sort
    : (tools.sorts[0]?.value ?? '');
  const filter = options.some((o) => o.value === view.filter) ? view.filter : '';
  return (
    <form
      role="search"
      aria-label="Search, filter, and sort"
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto] sm:items-end"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-q`}>Search</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id={`${id}-q`}
            type="search"
            autoComplete="off"
            className="pl-9"
            value={view.q}
            onChange={(e) => onChange({ ...view, q: e.target.value })}
          />
        </div>
      </div>
      {tools.filter ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${id}-filter`}>{tools.filter.label}</Label>
          <NativeSelect
            id={`${id}-filter`}
            value={filter}
            onChange={(e) => onChange({ ...view, filter: e.target.value })}
          >
            <option value="">All</option>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-sort`}>Sort by</Label>
        <NativeSelect
          id={`${id}-sort`}
          value={sort}
          onChange={(e) =>
            onChange({
              ...view,
              sort: e.target.value === tools.sorts[0]?.value ? '' : e.target.value,
            })
          }
        >
          {tools.sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {isDefaultView(view) ? null : (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange({ q: '', filter: '', sort: '' })}
        >
          Clear
        </Button>
      )}
    </form>
  );
}
