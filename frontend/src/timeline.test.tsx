import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { getLive } from './test/live';

// All names here are made up for the test.

const career = (id: number, company: string, startDate: string, endDate: string | null) => ({
  id,
  company,
  department: null,
  position: 'Developer',
  employmentType: 'full_time',
  startDate,
  endDate,
  duties: null,
  achievements: null,
});

function serve(
  data: { careers: object[]; educations: object[]; projects: object[] },
  fail = false,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-27' })));
      }
      if (fail)
        return Promise.resolve(new Response(JSON.stringify({ error: 'Down' }), { status: 503 }));
      const key = /\/api\/(\w+)/.exec(url)?.[1] as keyof typeof data;
      return Promise.resolve(new Response(JSON.stringify({ [key]: data[key] })));
    }),
  );
}

const project = {
  id: 7,
  name: 'Payments',
  organization: null,
  careerId: 1,
  startDate: '2022-05-01',
  endDate: '2022-09-01',
  role: null,
  summary: null,
  contributions: null,
  technologies: [],
  repositoryUrl: null,
  serviceUrl: null,
};

const school = {
  id: 3,
  school: 'Test U',
  major: 'Computer science',
  degree: 'bachelor',
  status: 'graduated',
  startDate: '2010-03-01',
  endDate: '2014-02-28',
  gpa: null,
  gpaScale: null,
  memo: null,
};

test('the menu leads to the timeline, which shows every kind newest first with projects under their career', async () => {
  serve({
    careers: [
      career(1, 'Hanbit Soft', '2020-01-01', null),
      career(2, 'Old Co', '2015-01-01', '2016-12-31'),
    ],
    educations: [school],
    projects: [project],
  });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Timeline' }));
  expect(window.location.pathname).toBe('/timeline');
  expect(await screen.findByRole('heading', { level: 1, name: 'Timeline' })).toBeInTheDocument();
  await screen.findByLabelText('Career: Hanbit Soft');

  const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  // The project is nested in its career, and the two earlier items follow in time order.
  expect(titles).toEqual(['Hanbit Soft', 'Payments', 'Old Co', 'Test U']);
  const job = screen.getByLabelText('Career: Hanbit Soft');
  expect(within(job).getByText('Ongoing')).toBeInTheDocument();
  expect(within(job).getByRole('list', { name: 'Projects at Hanbit Soft' })).toBeInTheDocument();
  expect(getLive('status')).toHaveTextContent('4 entries');
  // Each entry links to its edit screen.
  expect(screen.getByRole('link', { name: 'Edit Hanbit Soft' })).toHaveAttribute(
    'href',
    '/careers/1/edit',
  );
  expect(screen.getByRole('link', { name: 'Edit Payments' })).toHaveAttribute(
    'href',
    '/projects/7/edit',
  );
  expect(screen.getByRole('link', { name: 'Edit Test U' })).toHaveAttribute(
    'href',
    '/educations/3/edit',
  );
  expect(within(menu).getByRole('link', { name: 'Timeline' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('overlapping entries share one group', async () => {
  serve({
    careers: [career(1, 'Job A', '2018-01-01', '2021-12-31')],
    educations: [{ ...school, startDate: '2020-03-01', endDate: '2022-02-28' }],
    projects: [],
  });
  window.history.replaceState(null, '', '/timeline');
  render(<App />);
  const group = await screen.findByRole('list', { name: 'Overlapping entries' });
  expect(
    within(group)
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent),
  ).toEqual(['Test U', 'Job A']);
});

test('an empty timeline explains what will appear', async () => {
  serve({ careers: [], educations: [], projects: [] });
  window.history.replaceState(null, '', '/timeline');
  render(<App />);
  expect(await screen.findByText('Nothing on the timeline yet')).toBeInTheDocument();
});

test('a load error is shown with a retry', async () => {
  serve({ careers: [], educations: [], projects: [] }, true);
  window.history.replaceState(null, '', '/timeline');
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
