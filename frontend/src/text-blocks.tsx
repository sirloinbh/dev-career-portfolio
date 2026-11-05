import type { ReactElement } from 'react';

// Labelled blocks inside a list item (#40 review, shared from #42).

/**
 * Labelled entries (duties, achievements, technologies), only those that were filled in. A
 * description list ties each label to its content, so a screen reader announces where one block
 * ends. Text keeps its line breaks.
 */
export function TextBlocks({
  entries,
}: {
  entries: [label: string, content: ReactElement | string | null][];
}) {
  const filled = entries.filter(([, content]) => content !== null && content !== '');
  if (filled.length === 0) return null;
  return (
    <dl className="flex flex-col gap-2">
      {filled.map(([label, content]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-caption font-medium text-muted-foreground">{label}</dt>
          <dd className="text-body-sm wrap-break-word break-keep whitespace-pre-line">{content}</dd>
        </div>
      ))}
    </dl>
  );
}
