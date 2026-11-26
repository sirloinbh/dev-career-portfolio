import { Briefcase, FolderKanban, GraduationCap, History } from 'lucide-react';
import { Link } from 'react-router';

import { careerList } from './career-data';
import { Badge } from './components/ui/badge';
import { EmptyState } from './components/ui/empty-state';
import { SkeletonList } from './components/ui/skeleton';
import { educationList } from './education-data';
import { LoadErrorNotice } from './item-list-page-notice';
import { useListQuery } from './list-query';
import { PageHeader } from './page-header';
import { projectList } from './project-data';
import { serviceToday } from './service-date';
import { buildTimeline, type TimelineEntry, type TimelineKind } from './timeline-data';

// The timeline (#240): careers, education, and projects on one time axis, newest first. It reads the same three lists
// as their own pages, so a change made there shows here at once.

export type TimelinePaths = Record<TimelineKind, (id: number) => string>;

const kindLabels: Record<TimelineKind, string> = {
  career: 'Career',
  education: 'Education',
  project: 'Project',
};
const kindIcons = { career: Briefcase, education: GraduationCap, project: FolderKanban };

function EntryCard({
  item,
  paths,
  nested = false,
}: {
  item: TimelineEntry;
  paths: TimelinePaths;
  nested?: boolean;
}) {
  const Icon = kindIcons[item.kind];
  return (
    <li
      aria-label={`${kindLabels[item.kind]}: ${item.title}`}
      className={`flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 text-card-foreground shadow-sm ${nested ? 'bg-muted/40' : ''}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-body-sm text-muted-foreground">{kindLabels[item.kind]}</span>
        {item.ongoing ? <Badge>Ongoing</Badge> : null}
      </div>
      <h2 className="text-body font-semibold wrap-anywhere break-keep">
        <Link
          to={paths[item.kind](item.id)}
          className="underline-offset-4 hover:underline focus-visible:underline"
          aria-label={`Edit ${item.title}`}
        >
          {item.title}
        </Link>
      </h2>
      {item.detail ? <p className="text-body-sm wrap-anywhere break-keep">{item.detail}</p> : null}
      <p className="text-body-sm text-muted-foreground">{item.periodText}</p>
      {item.projects.length > 0 ? (
        <ul aria-label={`Projects at ${item.title}`} className="flex flex-col gap-2 pt-1">
          {item.projects.map((project) => (
            <EntryCard key={project.key} item={project} paths={paths} nested />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function TimelinePage({ paths }: { paths: TimelinePaths }) {
  // Read once per render: ongoing items run up to the service date, not the device's date.
  const today = serviceToday();
  const careers = useListQuery(careerList);
  const educations = useListQuery(educationList);
  const projects = useListQuery(projectList);
  const queries = [careers.query, educations.query, projects.query];
  const firstLoad = queries.some((q) => q.isPending);
  const failed = queries.find((q) => q.isError);
  const [careerRows, educationRows, projectRows] = [careers.rows, educations.rows, projects.rows];
  const clusters =
    careerRows && educationRows && projectRows
      ? buildTimeline(
          { careers: careerRows, educations: educationRows, projects: projectRows },
          today,
        )
      : undefined;
  const count = clusters?.flat().reduce((sum, item) => sum + 1 + item.projects.length, 0) ?? 0;
  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Timeline"
        description="Careers, education, and projects on one time axis, newest first. Items that overlap sit side by side."
      >
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading the timeline' : ''}
          {clusters ? `${String(count)} ${count === 1 ? 'entry' : 'entries'}` : ''}
        </p>
      </PageHeader>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      <LoadErrorNotice
        failed={failed ? { error: failed.error } : undefined}
        noun="the timeline"
        hasRows={clusters !== undefined}
        onRetry={() => queries.filter((q) => q.isError).forEach((q) => void q.refetch())}
      />
      {clusters && count === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<History />}
          title="Nothing on the timeline yet"
          description="Add a career, education, or project and it will appear here, newest first."
        />
      ) : null}
      {clusters?.map((cluster) => (
        <ul
          key={cluster[0]?.key}
          aria-label={cluster.length > 1 ? 'Overlapping entries' : undefined}
          className="grid items-start gap-4 sm:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]"
        >
          {cluster.map((item) => (
            <EntryCard key={item.key} item={item} paths={paths} />
          ))}
        </ul>
      ))}
    </section>
  );
}
