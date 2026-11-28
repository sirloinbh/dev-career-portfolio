import { render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import type { Dashboard } from './dashboard-data';
import { parseRequest, unexpectedRequest } from './test/route';

// All names here are made up for the test.

const summary: Dashboard = {
  today: '2026-11-16',
  windows: { deadlineDays: 14, interviewDays: 14, expiryDays: 90 },
  counts: { educations: 1, careers: 2, projects: 3, skills: 4, certifications: 5, applications: 6 },
  upcomingDeadlines: [
    { id: 1, companyName: '구름데이터', position: '백엔드 개발', deadline: '2026-11-16' },
    { id: 2, companyName: '바다물류', position: null, deadline: '2026-11-20' },
  ],
  upcomingInterviews: [
    {
      id: 5,
      applicationId: 2,
      companyName: '바다물류',
      position: null,
      round: 2,
      date: '2026-11-18',
      time: '14:30',
    },
  ],
  expiringCertifications: [
    { id: 7, name: '정보처리기사', issuer: '한국산업인력공단', expiryDate: '2026-12-01' },
  ],
  recentlyChanged: [
    { section: 'skills', id: 3, title: 'TypeScript', updatedAt: '2026-11-15T20:00:00.000Z' },
  ],
};

function serve(body: Dashboard | 'offline') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseRequest(input, init);
      if (request.method === 'GET' && request.path === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-16' })));
      }
      if (request.method !== 'GET' || request.path !== '/api/dashboard')
        return unexpectedRequest(request);
      if (body === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(new Response(JSON.stringify(body)));
    }),
  );
  window.history.replaceState(null, '', '/dashboard');
  render(<App />);
}

test('the dashboard shows counts, deadlines, expiries and recent changes with links', async () => {
  serve(summary);
  const counts = await screen.findByRole('list', { name: 'Items per section' });
  expect(within(counts).getByRole('link', { name: /Cover letters\s*6 items/ })).toHaveAttribute(
    'href',
    '/applications',
  );
  expect(within(counts).getByRole('link', { name: /Education\s*1 item$/ })).toHaveAttribute(
    'href',
    '/educations',
  );

  const deadlines = screen.getByRole('region', { name: 'Upcoming deadlines' });
  expect(within(deadlines).getByText(/구름데이터 · 백엔드 개발/)).toBeInTheDocument();
  expect(within(deadlines).getByText('Nov 16, 2026 · Today')).toBeInTheDocument();
  expect(within(deadlines).getByText('Nov 20, 2026 · D-4')).toBeInTheDocument();

  const interviews = screen.getByRole('region', { name: 'Upcoming interviews' });
  expect(within(interviews).getByText('바다물류 · Round 2')).toBeInTheDocument();
  expect(within(interviews).getByText('Nov 18, 2026 · D-2 · 14:30')).toBeInTheDocument();
  expect(within(interviews).getByRole('link')).toHaveAttribute('href', '/applications/2');

  const expiring = screen.getByRole('region', { name: 'Expiring certifications' });
  expect(within(expiring).getByText('Expires Dec 1, 2026 · D-15')).toBeInTheDocument();
  const recent = screen.getByRole('region', { name: 'Recently changed' });
  // 20:00 UTC on the 15th is already the 16th in Seoul.
  expect(within(recent).getByText('Skills · Nov 16, 2026')).toBeInTheDocument();
  expect(within(recent).getByRole('link', { name: /TypeScript/ })).toHaveAttribute(
    'href',
    '/skills',
  );

  expect(screen.queryByText('No features yet')).not.toBeInTheDocument();
});

test('a card with nothing to show says so', async () => {
  serve({
    ...summary,
    counts: {
      educations: 0,
      careers: 0,
      projects: 0,
      skills: 0,
      certifications: 0,
      applications: 0,
    },
    upcomingDeadlines: [],
    upcomingInterviews: [],
    expiringCertifications: [],
    recentlyChanged: [],
  });
  expect(await screen.findByText('No deadlines in the next 14 days')).toBeInTheDocument();
  expect(screen.getByText('No interviews in the next 14 days')).toBeInTheDocument();
  expect(screen.getByText('No certifications expire in the next 90 days')).toBeInTheDocument();
  expect(screen.getByText('Nothing has been added yet')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
});

test('a failed load is announced', async () => {
  serve('offline');
  expect(
    await screen.findByText(/reach|fetch/i, { selector: '[role="alert"]' }),
  ).toBeInTheDocument();
});
