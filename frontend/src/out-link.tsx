import { ExternalLink } from 'lucide-react';

// A list item's outside link (project #42, application #48).

/** A link that opens in a new tab; its name says whose link it is and that a tab opens. */
export function OutLink({ href, label, owner }: { href: string; label: string; owner: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} of ${owner} (opens in a new tab)`}
      className="inline-flex min-h-9 items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11"
    >
      {label}
      <ExternalLink aria-hidden className="size-3.5" />
    </a>
  );
}
