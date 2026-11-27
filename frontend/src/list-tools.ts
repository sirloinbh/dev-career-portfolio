import { type Career, employmentTypeLabels, employmentTypes } from './career-data';
import { type Certification, isExpired } from './certification-data';
import { degreeLabels, type Education, statuses, statusLabels } from './education-data';
import { byDate, byText, type ListTools } from './list-view';
import type { Project } from './project-data';
import { type Skill, skillCategories, skillCategoryLabels } from './skill-data';

// What each resume list can search, filter, and sort by (#238). The first sort of each list is the order the API sends.

const oldestStart = <R extends { startDate: string }>(a: R, b: R) =>
  a.startDate.localeCompare(b.startDate);

export const careerTools: ListTools<Career> = {
  searchText: (c) => [c.company, c.department, c.position, c.duties, c.achievements],
  filter: {
    label: 'Employment type',
    options: () =>
      employmentTypes.map((t) => ({
        value: t,
        label: employmentTypeLabels[t],
        matches: (c: Career) => c.employmentType === t,
      })),
  },
  sorts: [
    { value: 'newest', label: 'Newest start first' },
    { value: 'oldest', label: 'Oldest start first', compare: oldestStart },
    { value: 'company', label: 'Company A to Z', compare: (a, b) => byText(a.company, b.company) },
  ],
};

export const educationTools: ListTools<Education> = {
  searchText: (e) => [e.school, e.major, e.memo],
  filter: {
    label: 'Status',
    options: () =>
      statuses.map((s) => ({
        value: s,
        label: statusLabels[s],
        matches: (e: Education) => e.status === s,
      })),
  },
  sorts: [
    { value: 'newest', label: 'Newest enrollment first' },
    { value: 'oldest', label: 'Oldest enrollment first', compare: oldestStart },
    { value: 'school', label: 'School A to Z', compare: (a, b) => byText(a.school, b.school) },
    {
      value: 'degree',
      label: 'Degree',
      compare: (a, b) => byText(degreeLabels[a.degree], degreeLabels[b.degree]),
    },
  ],
};

/** The years a project was running in, newest first. A running project counts up to `thisYear`. */
export function projectYears(projects: readonly Project[], thisYear = new Date().getFullYear()) {
  const years = new Set<number>();
  for (const p of projects) {
    const first = Number(p.startDate.slice(0, 4));
    const last = p.endDate ? Number(p.endDate.slice(0, 4)) : Math.max(first, thisYear);
    for (let y = first; y <= last; y += 1) years.add(y);
  }
  return [...years].sort((a, b) => b - a);
}

/** `skillNames` maps a skill id to its name, so a search also finds a project by the skills it used (#261). */
export const projectTools = (skillNames: ReadonlyMap<number, string>): ListTools<Project> => ({
  searchText: (p) => [
    p.name,
    p.organization,
    p.role,
    p.summary,
    p.contributions,
    ...p.skillIds.map((id) => skillNames.get(id)),
  ],
  filter: {
    label: 'Year',
    options: (projects) =>
      projectYears(projects).map((y) => ({
        value: String(y),
        label: String(y),
        // The project was running at some point in that year.
        matches: (p: Project) =>
          p.startDate.slice(0, 4) <= String(y) &&
          (!p.endDate || p.endDate.slice(0, 4) >= String(y)),
      })),
  },
  sorts: [
    { value: 'newest', label: 'Newest start first' },
    { value: 'oldest', label: 'Oldest start first', compare: oldestStart },
    { value: 'name', label: 'Name A to Z', compare: (a, b) => byText(a.name, b.name) },
  ],
});

export const skillTools: ListTools<Skill> = {
  searchText: (s) => [s.name, s.memo, skillCategoryLabels[s.category]],
  filter: {
    label: 'Category',
    options: () =>
      skillCategories.map((c) => ({
        value: c,
        label: skillCategoryLabels[c],
        matches: (s: Skill) => s.category === c,
      })),
  },
  // The list groups by category, so a sort orders the skills inside each group.
  sorts: [
    { value: 'strongest', label: 'Strongest first' },
    {
      value: 'weakest',
      label: 'Least proficient first',
      compare: (a, b) => a.proficiency - b.proficiency,
    },
    { value: 'name', label: 'Name A to Z', compare: (a, b) => byText(a.name, b.name) },
  ],
};

/** `today` is the service date, so "expired" agrees with the badge on each row. */
export function certificationTools(today: string): ListTools<Certification> {
  return {
    searchText: (c) => [c.name, c.issuer, c.score, c.memo],
    filter: {
      label: 'Status',
      options: () => [
        {
          value: 'valid',
          label: 'Valid',
          matches: (c) => c.expiryDate !== null && !isExpired(c, today),
        },
        { value: 'expired', label: 'Expired', matches: (c) => isExpired(c, today) },
        { value: 'no-expiry', label: 'No expiry', matches: (c) => c.expiryDate === null },
      ],
    },
    sorts: [
      { value: 'newest', label: 'Newest first' },
      {
        value: 'expiry',
        label: 'Expiry date, soonest first',
        // A certification without an expiry date sorts last.
        compare: (a, b) => byDate(a.expiryDate, b.expiryDate),
      },
      { value: 'name', label: 'Name A to Z', compare: (a, b) => byText(a.name, b.name) },
    ],
  };
}
