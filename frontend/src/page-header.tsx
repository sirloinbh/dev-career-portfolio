import { ArrowLeft } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { Link } from 'react-router';

import { Button } from './components/ui/button';

// Page parts every portfolio item screen shares (#38 structure, shared from #40).

export function PageHeader({
  title,
  description,
  headingRef,
  children,
}: {
  title: string;
  description: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-2">
      {/* tabIndex -1 lets the page move focus here after the focused row is deleted. */}
      <h1 id="page-title" ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {title}
      </h1>
      <p className="text-body break-keep text-muted-foreground">{description}</p>
      {children}
    </header>
  );
}

/** "← Education list": back to an item's list from its form. */
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="ghost" size="sm" className="w-fit">
      <Link to={to}>
        <ArrowLeft aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
