import { expect, test } from 'vitest';

import type { Career } from './career-data';
import type { Certification } from './certification-data';
import type { Education } from './education-data';
import {
  careerTools,
  certificationTools,
  educationTools,
  projectTools,
  projectYears,
  skillTools,
} from './list-tools';
import {
  applyListView,
  emptyListView,
  fromViewParams,
  isDefaultView,
  matchesSearch,
  normalizeSearch,
  toViewParams,
} from './list-view';
import type { Project } from './project-data';
import type { Skill } from './skill-data';

// All names here are made up for the test.

const view = (patch: Partial<typeof emptyListView>) => ({ ...emptyListView, ...patch });
const ids = (rows: { id: number }[]) => rows.map((r) => r.id);

const career = (id: number, company: string, patch: Partial<Career> = {}): Career => ({
  id,
  company,
  department: null,
  position: null,
  employmentType: 'full_time',
  startDate: '2020-01-01',
  endDate: null,
  duties: null,
  achievements: null,
  ...patch,
});

test('search ignores case, extra spaces and composed versus decomposed Korean', () => {
  const rows = [career(1, '한빛소프트', { position: 'Backend Developer' }), career(2, 'Acme')];
  const search = (q: string) => ids(applyListView(rows, careerTools, view({ q })));
  expect(search('  backend   DEVELOPER ')).toEqual([1]);
  expect(search('한빛')).toEqual([1]);
  // The same text typed as separate Hangul letters (NFD), as macOS can send it.
  expect(search('한빛'.normalize('NFD'))).toEqual([1]);
  expect(search('')).toEqual([1, 2]);
  expect(search('nothing like this')).toEqual([]);
  expect(normalizeSearch('  A  b ')).toBe('a b');
  expect(matchesSearch(rows[0], careerTools, '소프트 backend')).toBe(true);
});

test('careers filter by employment type and sort by start or company', () => {
  const rows = [
    career(1, 'Beta', { startDate: '2022-01-01' }),
    career(2, 'Alpha', { employmentType: 'intern', startDate: '2018-01-01' }),
    career(3, 'Gamma', { startDate: '2020-01-01' }),
  ];
  expect(ids(applyListView(rows, careerTools, view({ filter: 'intern' })))).toEqual([2]);
  expect(ids(applyListView(rows, careerTools, view({ sort: 'oldest' })))).toEqual([2, 3, 1]);
  expect(ids(applyListView(rows, careerTools, view({ sort: 'company' })))).toEqual([2, 1, 3]);
  // An unknown filter or sort is ignored, so an old link does not hide rows.
  expect(ids(applyListView(rows, careerTools, view({ filter: 'x', sort: 'y' })))).toEqual([
    1, 2, 3,
  ]);
});

test('educations filter by status and sort by school or degree', () => {
  const edu = (id: number, school: string, patch: Partial<Education>): Education => ({
    id,
    school,
    major: null,
    degree: 'bachelor',
    status: 'graduated',
    startDate: '2015-03-02',
    endDate: null,
    gpa: null,
    gpaScale: null,
    memo: null,
    ...patch,
  });
  const rows = [edu(1, 'Zeta U', { status: 'enrolled', degree: 'master' }), edu(2, 'Alpha U', {})];
  expect(ids(applyListView(rows, educationTools, view({ filter: 'enrolled' })))).toEqual([1]);
  expect(ids(applyListView(rows, educationTools, view({ sort: 'school' })))).toEqual([2, 1]);
  expect(ids(applyListView(rows, educationTools, view({ sort: 'degree' })))).toEqual([2, 1]);
});

test('projects filter by a year they ran in, and search their technologies', () => {
  const project = (
    id: number,
    name: string,
    startDate: string,
    endDate: string | null,
    technologies: string[] = [],
  ): Project => ({
    id,
    name,
    organization: null,
    careerId: null,
    startDate,
    endDate,
    role: null,
    summary: null,
    contributions: null,
    technologies,
    repositoryUrl: null,
    serviceUrl: null,
  });
  const rows = [
    project(1, 'Old', '2019-05-01', '2020-02-01'),
    project(2, 'Long', '2020-06-01', '2022-01-01', ['Rust']),
    project(3, 'Running', '2024-01-01', null),
  ];
  expect(projectYears(rows, 2025)).toEqual([2025, 2024, 2022, 2021, 2020, 2019]);
  expect(ids(applyListView(rows, projectTools, view({ filter: '2020' })))).toEqual([1, 2]);
  expect(ids(applyListView(rows, projectTools, view({ filter: '2025' })))).toEqual([3]);
  expect(ids(applyListView(rows, projectTools, view({ q: 'rust' })))).toEqual([2]);
  expect(ids(applyListView(rows, projectTools, view({ sort: 'name' })))).toEqual([2, 1, 3]);
});

test('skills filter by category and sort by proficiency or name', () => {
  const skill = (
    id: number,
    name: string,
    category: Skill['category'],
    proficiency: number,
  ): Skill => ({
    id,
    name,
    category,
    proficiency,
    memo: null,
  });
  const rows = [
    skill(1, 'Go', 'language', 4),
    skill(2, 'Docker', 'tool', 2),
    skill(3, 'Rust', 'language', 1),
  ];
  expect(ids(applyListView(rows, skillTools, view({ filter: 'language' })))).toEqual([1, 3]);
  expect(ids(applyListView(rows, skillTools, view({ sort: 'weakest' })))).toEqual([3, 2, 1]);
  expect(ids(applyListView(rows, skillTools, view({ sort: 'name' })))).toEqual([2, 1, 3]);
  // The category label is searchable too.
  expect(ids(applyListView(rows, skillTools, view({ q: 'tool' })))).toEqual([2]);
});

test('certifications filter by status on the service date and sort by expiry with no expiry last', () => {
  const cert = (id: number, name: string, expiryDate: string | null): Certification => ({
    id,
    name,
    issuer: 'Test Board',
    acquiredDate: '2020-01-01',
    expiryDate,
    score: null,
    memo: null,
  });
  const rows = [
    cert(1, 'Forever', null),
    cert(2, 'Soon', '2026-12-01'),
    cert(3, 'Past', '2026-11-02'),
  ];
  const tools = certificationTools('2026-11-03');
  expect(ids(applyListView(rows, tools, view({ filter: 'valid' })))).toEqual([2]);
  expect(ids(applyListView(rows, tools, view({ filter: 'expired' })))).toEqual([3]);
  expect(ids(applyListView(rows, tools, view({ filter: 'no-expiry' })))).toEqual([1]);
  expect(ids(applyListView(rows, tools, view({ sort: 'expiry' })))).toEqual([3, 2, 1]);
  // The expiry day itself is still valid.
  expect(
    ids(applyListView(rows, certificationTools('2026-12-01'), view({ filter: 'valid' }))),
  ).toEqual([2]);
});

test('the view round-trips through the URL query and keeps other parameters', () => {
  const next = toViewParams(
    view({ q: '한빛', sort: 'name' }),
    new URLSearchParams('x=1&filter=old'),
  );
  expect(next.toString()).toBe('x=1&q=%ED%95%9C%EB%B9%9B&sort=name');
  expect(fromViewParams(next)).toEqual({ q: '한빛', filter: '', sort: 'name' });
  expect(isDefaultView(emptyListView)).toBe(true);
  expect(isDefaultView(view({ q: '  ' }))).toBe(true);
  expect(isDefaultView(view({ filter: 'a' }))).toBe(false);
});
