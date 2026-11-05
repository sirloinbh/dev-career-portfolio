import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import {
  type Certification,
  certificationPeriodText,
  isExpired,
  issuerText,
  serviceToday,
} from './certification-data';

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

/** 2026-11-05 00:30 in Seoul, which is still 2026-11-04 in UTC. Only Date is faked. */
function setSeoulJustAfterMidnight() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-04T15:30:00Z'));
}

afterEach(() => {
  vi.useRealTimers();
});

function openCertifications() {
  window.history.replaceState(null, '', '/certifications');
  render(<App />);
}

const item = (name: string) => screen.getByRole('listitem', { name });

test('the main menu leads to the certification list', async () => {
  serve({ status: 200, body: { certifications: [] } });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  fireEvent.click(within(menu).getByRole('link', { name: '자격증' }));
  expect(window.location.pathname).toBe('/certifications');
  expect(await screen.findByRole('heading', { level: 1, name: '자격증' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: '자격증' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('certifications are listed in the API order with issuer, score and dates', async () => {
  setSeoulJustAfterMidnight();
  serve({ status: 200, body: { certifications: [toeic, cloud, engineer] } });
  openCertifications();
  await screen.findByRole('list', { name: '자격증 목록' });
  expect(screen.getByRole('status')).toHaveTextContent('자격증 3건');
  expect(screen.getByRole('region', { name: '자격증' })).toHaveAttribute('aria-busy', 'false');
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
  ).toEqual(['TOEIC', 'AWS Solutions Architect – Associate', '정보처리기사']);

  const first = item('TOEIC');
  expect(within(first).getByText('ETS · 905점')).toBeInTheDocument();
  expect(within(first).getByText('취득 2025-03-09 · 만료 2027-03-08')).toBeInTheDocument();
  // The memo sits under its own label.
  expect(within(first).getByRole('term')).toHaveTextContent('메모');
  expect(within(first).getByRole('definition')).toHaveTextContent('스피킹은 별도 응시 예정');
  expect(within(first).queryByText('만료됨')).not.toBeInTheDocument();
});

test('a certification without an expiry date shows "만료 없음" instead of a date', async () => {
  setSeoulJustAfterMidnight();
  serve({ status: 200, body: { certifications: [engineer] } });
  openCertifications();
  await screen.findByRole('list', { name: '자격증 목록' });
  const row = item('정보처리기사');
  expect(within(row).getByText('취득 2023-08-30 · 만료 없음')).toBeInTheDocument();
  // No score: the issuer stands alone, with no trailing separator. No memo: no empty label.
  expect(within(row).getByText('한국산업인력공단')).toBeInTheDocument();
  expect(within(row).queryByRole('term')).not.toBeInTheDocument();
  expect(within(row).queryByText('만료됨')).not.toBeInTheDocument();
});

test('an expiry date before today in Seoul is marked expired, even while UTC is a day behind', async () => {
  setSeoulJustAfterMidnight();
  serve({ status: 200, body: { certifications: [cloud] } });
  openCertifications();
  await screen.findByRole('list', { name: '자격증 목록' });
  expect(
    within(item('AWS Solutions Architect – Associate')).getByText('만료됨'),
  ).toBeInTheDocument();
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { certifications: [] } });
  openCertifications();
  expect(await screen.findByText('아직 등록한 자격증이 없습니다')).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('자격증 0건');
  expect(screen.queryByRole('list', { name: '자격증 목록' })).not.toBeInTheDocument();
});

test('a failed request shows a Korean error with the reason', async () => {
  serve({ status: 500, body: { error: '서버 오류가 발생했습니다' } });
  openCertifications();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '자격증을 불러오지 못했습니다. 서버 오류가 발생했습니다',
  );
  expect(screen.queryByText('아직 등록한 자격증이 없습니다')).not.toBeInTheDocument();
});

test('an unreachable server is reported, not shown as an empty list', async () => {
  serve('offline');
  openCertifications();
  expect(await screen.findByRole('alert')).toHaveTextContent('자격증을 불러오지 못했습니다.');
  expect(screen.queryByText('아직 등록한 자격증이 없습니다')).not.toBeInTheDocument();
});

test('the loading state is announced and marks the page busy', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openCertifications();
  expect(screen.getByRole('status')).toHaveTextContent('자격증을 불러오는 중');
  expect(screen.getByRole('region', { name: '자격증' })).toHaveAttribute('aria-busy', 'true');
});

test('display rules: expiry, period and issuer text', () => {
  expect(isExpired({ expiryDate: null }, '2026-11-05')).toBe(false);
  expect(isExpired({ expiryDate: '2026-11-05' }, '2026-11-05')).toBe(false);
  expect(isExpired({ expiryDate: '2026-11-04' }, '2026-11-05')).toBe(true);
  expect(certificationPeriodText({ acquiredDate: '2024-05-17', expiryDate: null })).toBe(
    '취득 2024-05-17 · 만료 없음',
  );
  expect(issuerText({ issuer: 'ETS', score: null })).toBe('ETS');
  expect(issuerText({ issuer: 'ETS', score: '905점' })).toBe('ETS · 905점');
  // The service date, not the device's: 15:30 UTC is already the next day in Seoul.
  expect(serviceToday(new Date('2026-11-04T15:30:00Z'))).toBe('2026-11-05');
  expect(serviceToday(new Date('2026-11-04T14:59:00Z'))).toBe('2026-11-04');
});
