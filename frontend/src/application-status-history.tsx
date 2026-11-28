import { ArrowRight } from 'lucide-react';

import {
  applicationStatusLabels,
  applicationStatusVariant,
  type StatusChange,
  useStatusHistory,
} from './application-data';
import { Badge } from './components/ui/badge';
import { SkeletonList } from './components/ui/skeleton';
import { formatDate } from './lib/format';
import { errorText } from './lib/use-notice';

// The stage changes of one application (#229), oldest first. Read-only: a change is made by editing the
// application and choosing another status.

function ChangeRow({ change }: { change: StatusChange }) {
  return (
    <li className="flex flex-col gap-1 py-2 text-body-sm sm:flex-row sm:items-center sm:gap-3">
      <time dateTime={change.date} className="shrink-0 text-muted-foreground sm:w-40">
        {formatDate(change.date)}
      </time>
      <span className="flex flex-wrap items-center gap-2">
        {change.fromStatus ? (
          <>
            <Badge variant="outline">{applicationStatusLabels[change.fromStatus]}</Badge>
            <ArrowRight aria-label="changed to" className="size-4 text-muted-foreground" />
          </>
        ) : (
          <span className="text-muted-foreground">Started as</span>
        )}
        <Badge variant={applicationStatusVariant[change.status]}>
          {applicationStatusLabels[change.status]}
        </Badge>
      </span>
    </li>
  );
}

export function StatusHistory({
  applicationId,
  enabled,
}: {
  applicationId: string;
  enabled: boolean;
}) {
  const history = useStatusHistory(applicationId, enabled);
  return (
    <section aria-labelledby="status-history-title" className="flex flex-col gap-2">
      <h2 id="status-history-title" className="text-body font-semibold">
        Status history
      </h2>
      {history.isPending && enabled ? <SkeletonList rows={2} /> : null}
      {history.isError ? (
        <p role="alert" className="text-body-sm text-destructive">
          Could not load the status history. {errorText(history.error)}
        </p>
      ) : null}
      {history.data ? (
        <ol
          aria-label="Status changes"
          className="flex max-w-xl flex-col divide-y rounded-xl border bg-card px-4 text-card-foreground shadow-sm"
        >
          {history.data.history.map((change) => (
            <ChangeRow key={change.id} change={change} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
