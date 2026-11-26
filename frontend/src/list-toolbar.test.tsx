import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { getLive } from './test/live';

// One screen test per section (#238): each list searches, filters, sorts and keeps the choices in the URL.
// All names here are made up for the test.

function serve(key: string, rows: object[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-03' })));
      }
      return Promise.resolve(new Response(JSON.stringify({ [key]: rows })));
    }),
  );
}

function open(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

/** The h2 titles in the list, in screen order. */
const titles = (list: HTMLElement) =>
  within(list)
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent);

const choose = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

test('careers: search in Korean, filter by employment type, sort, and keep it in the URL', async () => {
  const base = {
    department: null,
    position: null,
    duties: null,
    achievements: null,
    endDate: null,
  };
  serve('careers', [
    { ...base, id: 1, company: '한빛소프트', employmentType: 'full_time', startDate: '2022-01-01' },
    { ...base, id: 2, company: 'Acme', employmentType: 'intern', startDate: '2018-01-01' },
    { ...base, id: 3, company: 'Beta', employmentType: 'full_time', startDate: '2020-01-01' },
  ]);
  open('/careers');
  const list = await screen.findByRole('list', { name: 'Career list' });
  expect(titles(list)).toEqual(['한빛소프트', 'Acme', 'Beta']);

  fireEvent.change(screen.getByLabelText('Search'), { target: { value: '한빛' } });
  expect(titles(screen.getByRole('list', { name: 'Career list' }))).toEqual(['한빛소프트']);
  expect(window.location.search).toBe('?q=%ED%95%9C%EB%B9%9B');
  expect(getLive('status')).toHaveTextContent('1 entry');

  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  choose('Employment type', 'full_time');
  choose('Sort by', 'company');
  expect(titles(screen.getByRole('list', { name: 'Career list' }))).toEqual(['Beta', '한빛소프트']);
  expect(window.location.search).toBe('?filter=full_time&sort=company');
});

test('a reload keeps the choices: the URL query is read on open', async () => {
  serve('careers', [
    {
      id: 1,
      company: 'Zed',
      department: null,
      position: null,
      employmentType: 'full_time',
      startDate: '2022-01-01',
      endDate: null,
      duties: null,
      achievements: null,
    },
    {
      id: 2,
      company: 'Abe',
      department: null,
      position: null,
      employmentType: 'full_time',
      startDate: '2018-01-01',
      endDate: null,
      duties: null,
      achievements: null,
    },
  ]);
  open('/careers?sort=company');
  const list = await screen.findByRole('list', { name: 'Career list' });
  expect(titles(list)).toEqual(['Abe', 'Zed']);
  expect(screen.getByLabelText('Sort by')).toHaveValue('company');
});

test('no match shows a message with a way back; an empty list shows no toolbar', async () => {
  serve('careers', [
    {
      id: 1,
      company: 'Acme',
      department: null,
      position: null,
      employmentType: 'full_time',
      startDate: '2022-01-01',
      endDate: null,
      duties: null,
      achievements: null,
    },
  ]);
  open('/careers');
  await screen.findByRole('list', { name: 'Career list' });
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } });
  expect(screen.getByRole('heading', { name: 'No entries match' })).toBeInTheDocument();
  expect(screen.queryByText('No career added yet')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear search and filter' }));
  expect(screen.getByRole('list', { name: 'Career list' })).toBeInTheDocument();
});

test('educations: filter by status and sort by school', async () => {
  const base = {
    major: null,
    degree: 'bachelor',
    endDate: null,
    gpa: null,
    gpaScale: null,
    memo: null,
  };
  serve('educations', [
    { ...base, id: 1, school: 'Zeta U', status: 'enrolled', startDate: '2024-03-04' },
    { ...base, id: 2, school: 'Alpha U', status: 'graduated', startDate: '2015-03-02' },
    { ...base, id: 3, school: 'Mid U', status: 'graduated', startDate: '2010-03-02' },
  ]);
  open('/educations');
  await screen.findByRole('list', { name: 'Education list' });
  choose('Status', 'graduated');
  choose('Sort by', 'school');
  expect(titles(screen.getByRole('list', { name: 'Education list' }))).toEqual([
    'Alpha U',
    'Mid U',
  ]);
});

test('projects: the year filter offers the years the projects ran in', async () => {
  const base = {
    organization: null,
    role: null,
    summary: null,
    contributions: null,
    careerId: null,
    skillIds: [],
    repositoryUrl: null,
    serviceUrl: null,
  };
  serve('projects', [
    { ...base, id: 1, name: 'Old one', startDate: '2019-05-01', endDate: '2019-09-01' },
    { ...base, id: 2, name: 'New one', startDate: '2021-05-01', endDate: '2021-09-01' },
  ]);
  open('/projects');
  await screen.findByRole('list', { name: 'Project list' });
  expect(
    within(screen.getByLabelText('Year'))
      .getAllByRole('option')
      .map((o) => o.textContent),
  ).toEqual(['All', '2021', '2019']);
  choose('Year', '2019');
  expect(titles(screen.getByRole('list', { name: 'Project list' }))).toEqual(['Old one']);
});

test('skills: filter by category and sort inside the groups', async () => {
  serve('skills', [
    {
      id: 1,
      name: 'Go',
      category: 'language',
      proficiency: 4,
      memo: null,
      projects: [],
      usedMonths: 0,
    },
    {
      id: 2,
      name: 'Rust',
      category: 'language',
      proficiency: 1,
      memo: null,
      projects: [],
      usedMonths: 0,
    },
    {
      id: 3,
      name: 'Docker',
      category: 'tool',
      proficiency: 2,
      memo: null,
      projects: [],
      usedMonths: 0,
    },
  ]);
  open('/skills');
  await screen.findByRole('heading', { level: 2, name: 'Language 2 entries' });
  choose('Sort by', 'weakest');
  const group = screen.getByRole('heading', { level: 2, name: 'Language 2 entries' })
    .parentElement as HTMLElement;
  expect(
    within(group)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent),
  ).toEqual(['Rust', 'Go']);
  choose('Category', 'tool');
  expect(screen.queryByRole('heading', { name: /Language/ })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 3, name: 'Docker' })).toBeInTheDocument();
});

test('certifications: filter by status on the service date and sort by expiry', async () => {
  const base = { issuer: 'Test Board', acquiredDate: '2020-01-01', score: null, memo: null };
  serve('certifications', [
    { ...base, id: 1, name: 'Forever', expiryDate: null },
    { ...base, id: 2, name: 'Soon', expiryDate: '2026-12-01' },
    { ...base, id: 3, name: 'Past', expiryDate: '2026-11-02' },
  ]);
  open('/certifications');
  await screen.findByRole('list', { name: 'Certification list' });
  choose('Status', 'expired');
  expect(titles(screen.getByRole('list', { name: 'Certification list' }))).toEqual(['Past']);
  choose('Status', '');
  choose('Sort by', 'expiry');
  expect(titles(screen.getByRole('list', { name: 'Certification list' }))).toEqual([
    'Past',
    'Soon',
    'Forever',
  ]);
});
