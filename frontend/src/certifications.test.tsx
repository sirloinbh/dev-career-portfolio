import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import {
  type Certification,
  certificationPeriodText,
  isExpired,
  issuerText,
} from './certification-data';
import { serviceToday } from './service-date';

// All certifications here are made up for the test.

const certification = (
  id: number,
  name: string,
  acquiredDate: string,
  expiryDate: string | null,
): Certification => ({
  id,
  name,
  issuer: '한국산업인력공단',
  acquiredDate,
  expiryDate,
  score: null,
  memo: null,
});

const toeic: Certification = {
  ...certification(1, 'TOEIC', '2025-03-09', '2027-03-08'),
  issuer: 'ETS',
  score: '905점',
  memo: '스피킹은 별도 응시 예정',
};
const engineer = certification(2, '정보처리기사', '2023-08-30', null);
// Expired on 2026-11-04, the day before "today" in Seoul below.
const cloud: Certification = {
  ...certification(3, 'AWS Solutions Architect – Associate', '2023-11-05', '2026-11-04'),
  issuer: 'Amazon Web Services',
};

/** Answers /api/certifications with `result` (or an error) and /api/health with a date. */
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

/**
 * 2026-11-05 00:30 in Seoul, which is still 2026-11-04 in UTC (the tests run with TZ=UTC). Only
 * Date is faked; src/test/setup.ts restores real timers after each test.
 */
function setSeoulJustAfterMidnight() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-04T15:30:00Z'));
}

function openCertifications() {
  window.history.replaceState(null, '', '/certifications');
  render(<App />);
}

const item = (name: string) => screen.getByRole('listitem', { name });

test('the main menu leads to the certification list', async () => {
  serve({ status: 200, body: { certifications: [] } });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Certifications' }));
  expect(window.location.pathname).toBe('/certifications');
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Certifications' }),
  ).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Certifications' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('certifications are listed in the API order with issuer, score and dates', async () => {
  setSeoulJustAfterMidnight();
  serve({ status: 200, body: { certifications: [toeic, cloud, engineer] } });
  openCertifications();
  await screen.findByRole('list', { name: 'Certification list' });
  expect(screen.getByRole('status')).toHaveTextContent('3 entries');
  expect(screen.getByRole('region', { name: 'Certifications' })).toHaveAttribute(
    'aria-busy',
    'false',
  );
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
  ).toEqual(['TOEIC', 'AWS Solutions Architect – Associate', '정보처리기사']);

  const first = item('TOEIC');
  expect(within(first).getByText('ETS · 905점')).toBeInTheDocument();
  expect(
    within(first).getByText('Earned March 9, 2025 · Expires March 8, 2027'),
  ).toBeInTheDocument();
  // The memo sits under its own label.
  expect(within(first).getByRole('term')).toHaveTextContent('Notes');
  expect(within(first).getByRole('definition')).toHaveTextContent('스피킹은 별도 응시 예정');
  expect(within(first).queryByText('Expired')).not.toBeInTheDocument();
});

test('a certification without an expiry date shows "No expiry" instead of a date', async () => {
  setSeoulJustAfterMidnight();
  serve({ status: 200, body: { certifications: [engineer] } });
  openCertifications();
  await screen.findByRole('list', { name: 'Certification list' });
  const row = item('정보처리기사');
  expect(within(row).getByText('Earned August 30, 2023 · No expiry')).toBeInTheDocument();
  // No score: the issuer stands alone, with no trailing separator. No memo: no empty label.
  expect(within(row).getByText('한국산업인력공단')).toBeInTheDocument();
  expect(within(row).queryByRole('term')).not.toBeInTheDocument();
  expect(within(row).queryByText('Expired')).not.toBeInTheDocument();
});

test('an expiry date before today in Seoul is marked expired, even while UTC is a day behind', async () => {
  setSeoulJustAfterMidnight();
  serve({ status: 200, body: { certifications: [cloud] } });
  openCertifications();
  await screen.findByRole('list', { name: 'Certification list' });
  expect(
    within(item('AWS Solutions Architect – Associate')).getByText('Expired'),
  ).toBeInTheDocument();
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { certifications: [] } });
  openCertifications();
  expect(await screen.findByText('No certifications added yet')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('0 entries');
  expect(screen.queryByRole('list', { name: 'Certification list' })).not.toBeInTheDocument();
});

test('a failed request shows an English error with the reason', async () => {
  serve({ status: 500, body: { error: 'Server error' } });
  openCertifications();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load certifications. Server error',
  );
  expect(screen.queryByText('No certifications added yet')).not.toBeInTheDocument();
});

test('an unreachable server is reported, not shown as an empty list', async () => {
  serve('offline');
  openCertifications();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load certifications.');
  expect(screen.queryByText('No certifications added yet')).not.toBeInTheDocument();
});

test('the loading state is announced and marks the page busy', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openCertifications();
  expect(screen.getByRole('status')).toHaveTextContent('Loading certifications');
  expect(screen.getByRole('region', { name: 'Certifications' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
});

test('display rules: expiry, period and issuer text', () => {
  expect(isExpired({ expiryDate: null }, '2026-11-05')).toBe(false);
  expect(isExpired({ expiryDate: '2026-11-05' }, '2026-11-05')).toBe(false);
  expect(isExpired({ expiryDate: '2026-11-04' }, '2026-11-05')).toBe(true);
  expect(certificationPeriodText({ acquiredDate: '2024-05-17', expiryDate: null })).toBe(
    'Earned May 17, 2024 · No expiry',
  );
  expect(issuerText({ issuer: 'ETS', score: null })).toBe('ETS');
  expect(issuerText({ issuer: 'ETS', score: '905점' })).toBe('ETS · 905점');
  // The service date, not the device's: 15:30 UTC is already the next day in Seoul.
  expect(serviceToday(new Date('2026-11-04T15:30:00Z'))).toBe('2026-11-05');
  expect(serviceToday(new Date('2026-11-04T14:59:00Z'))).toBe('2026-11-04');
});
