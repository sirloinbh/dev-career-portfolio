import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { type Application, deadlineText } from './application-data';
import { daysUntil } from './service-date';

// All companies here are made up for the test.

const application = (
  id: number,
  companyName: string,
  status: Application['status'],
  deadline: string | null,
): Application => ({
  id,
  companyName,
  position: null,
  postingUrl: null,
  deadline,
  status,
  memo: null,
});

const near: Application = {
  ...application(1, '구름데이터', 'drafting', '2026-11-08'),
  position: '백엔드 개발',
  postingUrl: 'https://careers.example.com/jobs/12',
  memo: '포트폴리오 링크 첨부',
};
const today = application(2, '한빛소프트', 'drafting', '2026-11-05');
const open = application(3, '새벽커머스', 'drafting', null);
const sent = application(4, '바다물류', 'submitted', '2026-11-01');
const done = application(5, '숲게임즈', 'closed', '2025-01-10');

/** Answers /api/applications with `result` (or an error) and /api/health with a date. */
function serve(result: { status: number; body: object } | 'offline') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-05' })));
      }
      if (result === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(new Response(JSON.stringify(result.body), { status: result.status }));
    }),
  );
}

/** 2026-11-05 00:30 in Seoul, which is still 2026-11-04 in UTC (the tests run with TZ=UTC). */
function setSeoulJustAfterMidnight() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-04T15:30:00Z'));
}

function openApplications() {
  window.history.replaceState(null, '', '/applications');
  render(<App />);
}

const item = (name: string) => screen.getByRole('listitem', { name });

test('the Cover letters menu leads to the application list', async () => {
  serve({ status: 200, body: { applications: [] } });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Cover letters' }));
  expect(window.location.pathname).toBe('/applications');
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Cover letters' }),
  ).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Cover letters' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('applications keep the API order and show status, position, deadline and memo', async () => {
  setSeoulJustAfterMidnight();
  serve({ status: 200, body: { applications: [near, today, open, sent, done] } });
  openApplications();
  await screen.findByRole('list', { name: 'Application list' });
  expect(screen.getByRole('status')).toHaveTextContent('5 entries');
  expect(screen.getByRole('region', { name: 'Cover letters' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
  ).toEqual(['구름데이터', '한빛소프트', '새벽커머스', '바다물류', '숲게임즈']);

  const first = item('구름데이터');
  expect(within(first).getByText('Drafting')).toBeInTheDocument();
  expect(within(first).getByText('백엔드 개발')).toBeInTheDocument();
  // 2026-11-08 is three days after "today" in Seoul (UTC is still 11-04, which would say four).
  expect(within(first).getByText('Due November 8, 2026 · D-3')).toBeInTheDocument();
  expect(within(first).getByRole('term')).toHaveTextContent('Notes');
  expect(within(first).getByRole('definition')).toHaveTextContent('포트폴리오 링크 첨부');

  expect(
    within(item('한빛소프트')).getByText('Due November 5, 2026 · Due today'),
  ).toBeInTheDocument();
  expect(within(item('새벽커머스')).getByText('No deadline')).toBeInTheDocument();
  // Submitted and closed applications show the date alone, without a countdown.
  expect(within(item('바다물류')).getByText('Submitted')).toBeInTheDocument();
  expect(within(item('바다물류')).getByText('Due November 1, 2026')).toBeInTheDocument();
  expect(within(item('숲게임즈')).getByText('Closed')).toBeInTheDocument();
  expect(within(item('숲게임즈')).getByText('Due January 10, 2025')).toBeInTheDocument();
});

test('the posting link opens in a new tab and names its company', async () => {
  serve({ status: 200, body: { applications: [near, open] } });
  openApplications();
  const link = await screen.findByRole('link', {
    name: 'Job posting of 구름데이터 (opens in a new tab)',
  });
  expect(link).toHaveAttribute('href', 'https://careers.example.com/jobs/12');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  // No link, position or memo stored: only the name, the status and the deadline line are shown,
  // with no empty line left for the missing parts.
  const bare = item('새벽커머스');
  expect(within(bare).queryByRole('link')).not.toBeInTheDocument();
  expect(within(bare).queryByRole('term')).not.toBeInTheDocument();
  expect([...bare.querySelectorAll('p')].map((line) => line.textContent)).toEqual(['No deadline']);
});

test('a posting link that is not a web address is never put in an href', async () => {
  serve({
    status: 200,
    body: { applications: [{ ...near, postingUrl: 'javascript:alert(1)' }] },
  });
  openApplications();
  await screen.findByRole('list', { name: 'Application list' });
  expect(within(item('구름데이터')).queryByRole('link')).not.toBeInTheDocument();
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { applications: [] } });
  openApplications();
  expect(await screen.findByText('No applications added yet')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('0 entries');
  expect(screen.queryByRole('list', { name: 'Application list' })).not.toBeInTheDocument();
});

test('a failed request shows an English error with the reason', async () => {
  serve({ status: 500, body: { error: 'Server error' } });
  openApplications();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load applications. Server error',
  );
  expect(screen.queryByText('No applications added yet')).not.toBeInTheDocument();
});

test('an unreachable server is reported, not shown as an empty list', async () => {
  serve('offline');
  openApplications();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load applications.');
  expect(screen.queryByText('No applications added yet')).not.toBeInTheDocument();
});

test('the loading state is announced and marks the page busy', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openApplications();
  expect(screen.getByRole('status')).toHaveTextContent('Loading applications');
  expect(screen.getByRole('region', { name: 'Cover letters' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
});

test('display rules: deadline countdown and day counts', () => {
  const drafting = (deadline: string | null) => ({ deadline, status: 'drafting' as const });
  expect(deadlineText(drafting(null), '2026-11-05')).toBe('No deadline');
  expect(deadlineText(drafting('2026-11-06'), '2026-11-05')).toBe('Due November 6, 2026 · D-1');
  expect(deadlineText(drafting('2026-11-05'), '2026-11-05')).toBe(
    'Due November 5, 2026 · Due today',
  );
  expect(deadlineText(drafting('2026-11-04'), '2026-11-05')).toBe('Due November 4, 2026 · Overdue');
  expect(deadlineText({ deadline: '2026-11-04', status: 'closed' }, '2026-11-05')).toBe(
    'Due November 4, 2026',
  );
  // Across a month end, a year end and a leap day.
  expect(daysUntil('2026-12-01', '2026-11-30')).toBe(1);
  expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1);
  expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2);
  expect(daysUntil('2026-11-01', '2026-11-05')).toBe(-4);
});
