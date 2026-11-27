import { type Career, careerPeriodText } from './career-data';
import { type Education, periodText as educationPeriodText } from './education-data';
import { type Project, projectPeriodText } from './project-data';

// The timeline (#240): careers, education, and projects on one time axis, newest first. Pure rules; timeline.tsx draws them.

export type TimelineKind = 'career' | 'education' | 'project';

export type TimelineEntry = {
  /** Unique across kinds: "career-3". */
  key: string;
  kind: TimelineKind;
  id: number;
  title: string;
  /** The second line: role, major, or organization. May be empty. */
  detail: string;
  periodText: string;
  /** YYYY-MM-DD. */
  start: string;
  /** YYYY-MM-DD; a period still running ends on `today`. */
  end: string;
  ongoing: boolean;
  /** Projects done at this career, newest start first. Only careers have any. */
  projects: TimelineEntry[];
};

/** Entries whose periods overlap, shown side by side. */
export type TimelineCluster = TimelineEntry[];

const entry = (
  kind: TimelineKind,
  id: number,
  title: string,
  detail: string,
  periodText: string,
  start: string,
  end: string | null,
  today: string,
  ongoingWithoutEnd = true,
): TimelineEntry => ({
  key: `${kind}-${String(id)}`,
  kind,
  id,
  title,
  detail,
  periodText,
  start,
  // A period that has not ended counts up to today; an end date is never later than the start's own day at minimum.
  end: end ?? (ongoingWithoutEnd && today > start ? today : start),
  ongoing: end === null && ongoingWithoutEnd,
  projects: [],
});

/** Newest start first; for the same start the one that ended later comes first, then the title. */
const newestFirst = (a: TimelineEntry, b: TimelineEntry) =>
  b.start.localeCompare(a.start) || b.end.localeCompare(a.end) || a.title.localeCompare(b.title);

const careerEntry = (c: Career, today: string) =>
  entry(
    'career',
    c.id,
    c.company,
    [c.position, c.department].filter(Boolean).join(' · '),
    careerPeriodText(c),
    c.startDate,
    c.endDate,
    today,
  );

const educationEntry = (e: Education, today: string) =>
  entry(
    'education',
    e.id,
    e.school,
    e.major ?? '',
    educationPeriodText(e),
    e.startDate,
    e.endDate,
    today,
    // A graduated or dropped-out record without an end date is a point in time, not a running period.
    e.status === 'enrolled' || e.status === 'on_leave',
  );

const projectEntry = (p: Project, today: string) =>
  entry(
    'project',
    p.id,
    p.name,
    p.organization ?? '',
    projectPeriodText(p),
    p.startDate,
    p.endDate,
    today,
  );

/** Groups newest-first entries into runs where each entry overlaps the ones before it. */
export function clusterOverlaps(entries: readonly TimelineEntry[]): TimelineCluster[] {
  const clusters: TimelineCluster[] = [];
  let earliestStart = '';
  for (const item of [...entries].sort(newestFirst)) {
    const current = clusters.at(-1);
    // Sorted by start, newest first: the item overlaps the run when it ends on or after the run's earliest start.
    if (current && item.end >= earliestStart) {
      current.push(item);
      if (item.start < earliestStart) earliestStart = item.start;
    } else {
      clusters.push([item]);
      earliestStart = item.start;
    }
  }
  return clusters;
}

/**
 * The timeline: careers, education, and projects with no career (or whose career is gone) in overlap clusters, newest
 * first. A project with a career sits under that career instead. `today` is the service date.
 */
export function buildTimeline(
  data: { careers: Career[]; educations: Education[]; projects: Project[] },
  today: string,
): TimelineCluster[] {
  const careers = data.careers.map((c) => careerEntry(c, today));
  const byId = new Map(careers.map((c) => [c.id, c]));
  const loose: TimelineEntry[] = [];
  for (const project of data.projects) {
    const owner = project.careerId === null ? undefined : byId.get(project.careerId);
    const item = projectEntry(project, today);
    if (owner) owner.projects.push(item);
    else loose.push(item);
  }
  for (const career of careers) career.projects.sort(newestFirst);
  return clusterOverlaps([
    ...careers,
    ...data.educations.map((e) => educationEntry(e, today)),
    ...loose,
  ]);
}
