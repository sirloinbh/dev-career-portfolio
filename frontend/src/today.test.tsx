import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

import { type Application, dueApplications } from './application-data';
import { createQueryClient } from './lib/query';
import { TodayPage } from './today';

// All companies here are made up for the test.
const row = (
  id: number,
  companyName: string,
  deadline: string | null,
  status: Application['status'] = 'drafting',
): Application => ({
  id,
  companyName,
  position: null,
  postingUrl: null,
  deadline,
  status,
  memo: null,
});

const today = '2026-11-27';
const rows = [
  row(1, 'Seven Days', '2026-12-04'),
  row(2, 'Eight Days', '2026-12-05'),
  row(3, 'Same Day', '2026-11-27'),
  row(4, 'Yesterday', '2026-11-26'),
  row(5, 'Long Ago', '2026-10-01'),
  row(6, 'Sent Late', '2026-11-20', 'submitted'),
  row(7, 'Rejected Soon', '2026-11-28', 'rejected'),
  row(8, 'No Deadline', null),
  row(9, 'Tomorrow', '2026-11-28'),
];

test('dueApplications keeps drafts that are overdue, due today, or due within 7 days', () => {
  const groups = dueApplications(rows, today);
  expect(groups.overdue.map((r) => r.companyName)).toEqual(['Long Ago', 'Yesterday']);
  expect(groups.today.map((r) => r.companyName)).toEqual(['Same Day']);
  expect(groups.soon.map((r) => r.companyName)).toEqual(['Tomorrow', 'Seven Days']);
});

const paths = {
  list: '/applications',
  create: '/applications/new',
  edit: (id: number) => `/applications/${String(id)}/edit`,
  questions: (id: number | string) => `/applications/${String(id)}`,
  editQuestions: (id: number | string) => `/applications/${String(id)}/questions/edit`,
};

function renderToday(response: () => Promise<Response>) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-27T03:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(response));
  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter>
        <TodayPage paths={paths} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const ok = (body: object, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

test('groups the due applications and links to the add form', async () => {
  renderToday(() => ok({ applications: rows }));
  const overdue = await screen.findByRole('region', { name: 'Overdue' });
  expect(within(overdue).getAllByRole('listitem')).toHaveLength(2);
  expect(
    within(screen.getByRole('region', { name: 'Due today' })).getByText('Same Day'),
  ).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Due in the next 7 days' })).getAllByRole('listitem'),
  ).toHaveLength(2);
  expect(screen.queryByText('Eight Days')).not.toBeInTheDocument();
  expect(screen.queryByText('Sent Late')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Add application' })).toHaveAttribute(
    'href',
    '/applications/new',
  );
  expect(screen.getByRole('link', { name: 'Cover letter questions for Same Day' })).toHaveAttribute(
    'href',
    '/applications/3',
  );
});

test('says so when nothing is due', async () => {
  renderToday(() => ok({ applications: [row(1, 'Far', '2027-01-01')] }));
  expect(await screen.findByText('Nothing due')).toBeInTheDocument();
});

test('shows a retry when the list cannot be loaded', async () => {
  renderToday(() => ok({ error: 'down' }, 400));
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
