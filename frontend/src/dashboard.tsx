import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { EmptyState } from './components/ui/empty-state';
import { SkeletonList } from './components/ui/skeleton';
import {
  type Dashboard,
  type DashboardSection,
  dashboardSections,
  dateWithCountdown,
  itemCountText,
  sectionLabels,
} from './dashboard-data';
import { type Health, healthText } from './health';
import { apiKey, useApiQuery } from './lib/query';
import { PageHeader } from './page-header';
import { daysUntil, formatDate, serviceToday } from './service-date';

export type DashboardPaths = Record<DashboardSection, string>;

function Block({ title, children }: { title: string; children: ReactNode }) {
  const id = `dashboard-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <Card aria-labelledby={id} role="region" className="gap-3 p-4">
      <CardHeader className="p-0">
        <CardTitle id={id} className="text-body font-semibold" asHeading="h2">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

const emptyText = (text: string) => <p className="text-body-sm text-muted-foreground">{text}</p>;

export function DashboardScreen({ paths, health }: { paths: DashboardPaths; health: Health }) {
  const query = useApiQuery<Dashboard>(apiKey('/api/dashboard'), '/api/dashboard');
  const data = query.data;
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="A personal portfolio service for organizing your career, projects, and skill growth"
      >
        <p
          role={health.state === 'error' ? 'alert' : 'status'}
          className={
            health.state === 'error'
              ? 'text-body-sm text-destructive'
              : 'text-caption text-muted-foreground'
          }
        >
          {healthText(health)}
        </p>
      </PageHeader>
      {query.isPending ? <SkeletonList rows={3} /> : null}
      {query.isError ? (
        <p role="alert" className="text-body-sm text-destructive">
          {query.error.message}
        </p>
      ) : null}
      {data ? (
        <>
          <ul
            aria-label="Items per section"
            className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
          >
            {dashboardSections.map((section) => (
              <li key={section}>
                <Link
                  to={paths[section]}
                  className="flex h-full flex-col gap-1 rounded-xl border p-4 hover:bg-muted"
                >
                  <span className="text-caption text-muted-foreground">
                    {sectionLabels[section]}
                  </span>
                  <span className="text-body font-semibold">
                    {itemCountText(data.counts[section])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            <Block title="Upcoming deadlines">
              {data.upcomingDeadlines.length === 0 ? (
                emptyText(`No deadlines in the next ${String(data.windows.deadlineDays)} days`)
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.upcomingDeadlines.map((row) => (
                    <li key={row.id}>
                      <Link
                        to={paths.applications}
                        className="flex flex-col underline-offset-4 hover:underline"
                      >
                        <span className="text-body wrap-anywhere break-keep">
                          {row.companyName}
                          {row.position ? ` · ${row.position}` : ''}
                        </span>
                        <span className="text-body-sm text-muted-foreground">
                          {dateWithCountdown(row.deadline, daysUntil(row.deadline, data.today))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
            <Block title="Expiring certifications">
              {data.expiringCertifications.length === 0 ? (
                emptyText(
                  `No certifications expire in the next ${String(data.windows.expiryDays)} days`,
                )
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.expiringCertifications.map((row) => (
                    <li key={row.id}>
                      <Link
                        to={paths.certifications}
                        className="flex flex-col underline-offset-4 hover:underline"
                      >
                        <span className="text-body wrap-anywhere break-keep">{row.name}</span>
                        <span className="text-body-sm text-muted-foreground">
                          {`Expires ${dateWithCountdown(row.expiryDate, daysUntil(row.expiryDate, data.today))}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
            <Block title="Recently changed">
              {data.recentlyChanged.length === 0 ? (
                emptyText('Nothing has been added yet')
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.recentlyChanged.map((row) => (
                    <li key={`${row.section}-${String(row.id)}`}>
                      <Link
                        to={paths[row.section]}
                        className="flex flex-col underline-offset-4 hover:underline"
                      >
                        <span className="text-body wrap-anywhere break-keep">{row.title}</span>
                        <span className="text-body-sm text-muted-foreground">
                          {`${sectionLabels[row.section]} · ${formatDate(serviceToday(new Date(row.updatedAt)))}`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Block>
          </div>
          {dashboardSections.every((s) => data.counts[s] === 0) ? (
            <EmptyState
              title="Nothing here yet"
              description="Add education, career, projects, skills, or certifications and a summary shows up here."
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
