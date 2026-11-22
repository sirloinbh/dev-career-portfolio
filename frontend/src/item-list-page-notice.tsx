import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import { errorText } from './lib/use-notice';

/**
 * The list's load error, with a retry. It is always mounted and only its text changes: the shared Notice
 * says a live region inserted together with its text is not announced by many screen readers (#684, #187).
 * `failed` is `undefined` while there is no error. With rows on screen (`hasRows`), the text says the list
 * may be out of date (#140); on a first load it says what could not be loaded. `noun` is "career", "skills".
 */
export function LoadErrorNotice({
  failed,
  noun,
  hasRows,
  onRetry,
}: {
  failed: { error: unknown } | undefined;
  noun: string;
  hasRows: boolean;
  onRetry: () => void;
}) {
  const text = failed
    ? hasRows
      ? `Could not refresh ${noun}. The list below may be out of date. ${errorText(failed.error)}`
      : // Say what failed first: a proxy error without a server message only carries the generic text.
        `Could not load ${noun}. ${errorText(failed.error)}`
    : undefined;
  return (
    // Without an error it only keeps the live regions in the page and takes no space.
    <div className={text ? 'flex flex-wrap items-center gap-3' : 'sr-only'}>
      <Notice notice={text ? { kind: 'error', text } : undefined} />
      {text ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
