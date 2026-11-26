import { CalendarCheck, Plus } from 'lucide-react';
import { Link } from 'react-router';

import {
  type Application,
  applicationList,
  type ApplicationPaths,
  deadlineText,
  dueApplications,
  todayWindowDays,
} from './application-data';
import { Button } from './components/ui/button';
import { EmptyState } from './components/ui/empty-state';
import { SkeletonList } from './components/ui/skeleton';
import { ItemUl } from './item-list-page';
import { LoadErrorNotice } from './item-list-page-notice';
import { useListQuery } from './list-query';
import { PageHeader } from './page-header';
import { serviceToday } from './service-date';

// The start page (#245): the applications that need attention now. It reads the same list as the
// Cover letters page, so a change made there shows here at once.

function DueGroup({
  label,
  rows,
  today,
  paths,
}: {
  label: string;
  rows: Application[];
  today: string;
  paths: ApplicationPaths;
}) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={label} className="flex flex-col gap-3">
      <h2 className="text-body font-semibold">
        {label} ({rows.length})
      </h2>
      <ItemUl label={label}>
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-body font-semibold wrap-anywhere break-keep">{row.companyName}</p>
              {row.position ? (
                <p className="text-body-sm wrap-anywhere break-keep">{row.position}</p>
              ) : null}
              <p className="text-body-sm text-muted-foreground">{deadlineText(row, today)}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link
                to={paths.questions(row.id)}
                aria-label={`Cover letter questions for ${row.companyName}`}
              >
                Open
              </Link>
            </Button>
          </li>
        ))}
      </ItemUl>
    </section>
  );
}

export function TodayPage({ paths }: { paths: ApplicationPaths }) {
  // Read once per render: "today" follows the service date, not the device's time zone.
  const today = serviceToday();
  const { query, rows } = useListQuery(applicationList);
  const firstLoad = query.isPending;
  const groups = rows ? dueApplications(rows, today) : undefined;
  const count = groups ? groups.overdue.length + groups.today.length + groups.soon.length : 0;
  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Today"
        description={`Applications still in drafting that are overdue, due today, or due in the next ${String(todayWindowDays)} days.`}
      >
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading applications' : ''}
          {groups
            ? `${String(count)} ${count === 1 ? 'application' : 'applications'} need attention`
            : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          Add application
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      <LoadErrorNotice
        failed={query.isError ? { error: query.error } : undefined}
        noun="applications"
        hasRows={groups !== undefined}
        onRetry={() => void query.refetch()}
      />
      {groups && count === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<CalendarCheck />}
          title="Nothing due"
          description={`No drafting application is overdue or due in the next ${String(todayWindowDays)} days.`}
        />
      ) : null}
      {groups ? (
        <>
          <DueGroup label="Overdue" rows={groups.overdue} today={today} paths={paths} />
          <DueGroup label="Due today" rows={groups.today} today={today} paths={paths} />
          <DueGroup label="Due in the next 7 days" rows={groups.soon} today={today} paths={paths} />
        </>
      ) : null}
    </section>
  );
}
