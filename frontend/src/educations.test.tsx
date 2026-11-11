import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { type Education, gpaText, periodText } from './education-data';

// All schools here are made up for the test.

const graduate: Education = {
  id: 2,
  school: '한빛대학원',
  major: '소프트웨어공학',
  degree: 'master',
  status: 'enrolled',
  startDate: '2024-03-04',
  endDate: null,
  gpa: null,
  gpaScale: null,
  memo: null,
};

const university: Education = {
  id: 1,
  school: '한빛대학교',
  major: '컴퓨터공학',
  degree: 'bachelor',
  status: 'graduated',
  startDate: '2015-03-02',
  endDate: '2019-02-20',
  gpa: 3.75,
  gpaScale: 4.5,
  memo: '졸업 작품: 일정 관리 앱',
};

/** Answers /api/educations with `educations` (or an error) and /api/health with a date. */
function serve(educations: { status: number; body: object } | 'offline') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-03' })));
      }
      if (educations === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(
        new Response(JSON.stringify(educations.body), { status: educations.status }),
      );
    }),
  );
}

function openEducations() {
  window.history.replaceState(null, '', '/educations');
  render(<App />);
}

test('the main menu leads to the education list', async () => {
  serve({ status: 200, body: { educations: [] } });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: '학력' }));
  expect(window.location.pathname).toBe('/educations');
  expect(await screen.findByRole('heading', { level: 1, name: '학력' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: '학력' })).toHaveAttribute('aria-current', 'page');
});

test('educations are listed in the order the API gives, not re-sorted', async () => {
  // Deliberately not newest first: the screen must keep the server's order.
  serve({ status: 200, body: { educations: [university, graduate] } });
  openEducations();
  const list = await screen.findByRole('list', { name: '학력 목록' });
  expect(screen.getByRole('status')).toHaveTextContent('학력 2건');
  const items = within(list).getAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('heading', { level: 2 }).textContent)).toEqual([
    '한빛대학교',
    '한빛대학원',
  ]);
});

/** The status badge text next to a school name. */
const badgeOf = (item: HTMLElement) => item.querySelector('[data-slot="badge"]')?.textContent;

test('each education shows its status, degree, period, grade and memo', async () => {
  serve({ status: 200, body: { educations: [graduate, university] } });
  openEducations();
  const list = await screen.findByRole('list', { name: '학력 목록' });

  const enrolled = within(list).getByRole('listitem', { name: '한빛대학원' });
  expect(badgeOf(enrolled)).toBe('재학 중');
  expect(enrolled).toHaveTextContent('석사 · 소프트웨어공학');
  expect(enrolled).toHaveTextContent('2024-03-04 ~');
  expect(enrolled).not.toHaveTextContent('학점');

  const done = within(list).getByRole('listitem', { name: '한빛대학교' });
  expect(badgeOf(done)).toBe('졸업');
  expect(done).not.toHaveTextContent('재학 중');
  expect(done).toHaveTextContent('2015-03-02 ~ 2019-02-20 · 학점 3.75 / 4.5');
  expect(done).toHaveTextContent('졸업 작품: 일정 관리 앱');
});

test('a placeholder shows while the list loads', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openEducations();
  expect(screen.getByRole('status')).toHaveTextContent('학력을 불러오는 중');
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { educations: [] } });
  openEducations();
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 학력이 없습니다' }),
  ).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '학력 목록' })).not.toBeInTheDocument();
});

test('a server error is shown in Korean', async () => {
  serve({ status: 503, body: { error: '데이터베이스에 연결할 수 없습니다' } });
  openEducations();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '학력을 불러오지 못했습니다. 데이터베이스에 연결할 수 없습니다',
  );
});

test('an error without a server message still says what failed', async () => {
  serve({ status: 502, body: {} });
  openEducations();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '학력을 불러오지 못했습니다. Could not process the request',
  );
});

test('an unreachable server is shown in Korean', async () => {
  serve('offline');
  openEducations();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '학력을 불러오지 못했습니다. Cannot reach the server',
  );
});

test('period and grade text', () => {
  expect(periodText({ status: 'graduated', startDate: '2015-03-02', endDate: '2019-02-20' })).toBe(
    '2015-03-02 ~ 2019-02-20',
  );
  expect(periodText({ status: 'enrolled', startDate: '2024-03-04', endDate: null })).toBe(
    '2024-03-04 ~',
  );
  expect(periodText({ status: 'on_leave', startDate: '2024-03-04', endDate: null })).toBe(
    '2024-03-04 ~',
  );
  // Finished without a recorded end: no open "~" that would read as still going.
  expect(periodText({ status: 'graduated', startDate: '2012-03-02', endDate: null })).toBe(
    '2012-03-02',
  );
  expect(periodText({ status: 'dropped_out', startDate: '2019-03-02', endDate: null })).toBe(
    '2019-03-02',
  );
  expect(gpaText({ gpa: 95, gpaScale: 100 })).toBe('학점 95 / 100');
  expect(gpaText({ gpa: null, gpaScale: null })).toBe('');
});
