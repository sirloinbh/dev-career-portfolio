import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import { errorText } from './lib/use-notice';

/**
 * Shown above rows that are still on screen when a reload fails (for example after a delete), so the
 * list is never silently stale. `noun` is the same word the first-load error uses ("career", "skills").
 */
export function ReloadNotice({
  noun,
  error,
  onRetry,
}: {
  noun: string;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Notice
        notice={{
          kind: 'error',
          text: `Could not refresh ${noun}. The list below may be out of date. ${errorText(error)}`,
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
