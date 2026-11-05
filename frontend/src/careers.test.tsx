import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { type Career, careerPeriodText, roleText } from './career-data';

// All companies here are made up for the test.

const current: Career = {
  id: 2,
  company: '한빛소프트',
  department: '플랫폼팀',
  position: '선임',
  employmentType: 'full_time',
  startDate: '2024-01-02',
  endDate: null,
  duties: '결제 API 개발',
  achievements: '응답 시간 40% 단축',
};

const past: Career = {
  id: 1,
  company: '새벽랩',
  department: null,
  position: null,
  employmentType: 'intern',
  startDate: '2019-07-01',
  endDate: '2019-12-31',
  duties: null,
  achievements: null,
};

/** Answers /api/careers with `careers` (or an error) and /api/health with a date. */
function serve(careers: { status: number; body: object } | 'offline') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-05' })));
      }
      if (careers === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(
        new Response(JSON.stringify(careers.body), { status: careers.status }),
      );
    }),
  );
}

function openCareers() {
  window.history.replaceState(null, '', '/careers');
  render(<App />);
}

test('the main menu leads to the career list', async () => {
  serve({ status: 200, body: { careers: [] } });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  fireEvent.click(within(menu).getByRole('link', { name: '이력' }));
  expect(window.location.pathname).toBe('/careers');
  expect(await screen.findByRole('heading', { level: 1, name: '이력' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: '이력' })).toHaveAttribute('aria-current', 'page');
});

test('careers are listed in the order the API gives, not re-sorted', async () => {
  // Deliberately oldest first: the screen must keep the server's order.
  serve({ status: 200, body: { careers: [past, current] } });
  openCareers();
  const list = await screen.findByRole('list', { name: '이력 목록' });
  expect(screen.getByRole('status')).toHaveTextContent('이력 2건');
  const items = within(list).getAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('heading', { level: 2 }).textContent)).toEqual([
    '새벽랩',
    '한빛소프트',
  ]);
});

/** The badge text next to a company name, if any. */
const badgeOf = (item: HTMLElement) => item.querySelector('[data-slot="badge"]')?.textContent;

test('a job still held shows "재직 중"; a finished one does not', async () => {
  serve({ status: 200, body: { careers: [current, past] } });
  openCareers();
  const list = await screen.findByRole('list', { name: '이력 목록' });

  const held = within(list).getByRole('listitem', { name: '한빛소프트' });
  expect(badgeOf(held)).toBe('재직 중');
  expect(held).toHaveTextContent('플랫폼팀 · 선임 · 정규직');
  expect(held).toHaveTextContent('2024-01-02 ~ 재직 중');
  expect(held).toHaveTextContent('담당 업무결제 API 개발');
  expect(held).toHaveTextContent('주요 성과응답 시간 40% 단축');

  const finished = within(list).getByRole('listitem', { name: '새벽랩' });
  expect(badgeOf(finished)).toBeUndefined();
  expect(finished).not.toHaveTextContent('재직 중');
  expect(finished).toHaveTextContent('인턴');
  expect(finished).toHaveTextContent('2019-07-01 ~ 2019-12-31');
  // Blank duties and achievements leave no empty labels behind.
  expect(finished).not.toHaveTextContent('담당 업무');
  expect(finished).not.toHaveTextContent('주요 성과');
});

test('a placeholder shows while the list loads', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openCareers();
  expect(screen.getByRole('status')).toHaveTextContent('이력을 불러오는 중');
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { careers: [] } });
  openCareers();
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 이력이 없습니다' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('이력 0건');
  expect(screen.queryByRole('list', { name: '이력 목록' })).not.toBeInTheDocument();
});

test('a server error is shown in Korean', async () => {
  serve({ status: 503, body: { error: '데이터베이스에 연결할 수 없습니다' } });
  openCareers();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '이력을 불러오지 못했습니다. 데이터베이스에 연결할 수 없습니다',
  );
});

test('an error without a server message still says what failed', async () => {
  serve({ status: 502, body: {} });
  openCareers();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '이력을 불러오지 못했습니다. 요청을 처리하지 못했습니다',
  );
});

test('an unreachable server is shown in Korean', async () => {
  serve('offline');
  openCareers();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '이력을 불러오지 못했습니다. 서버에 연결할 수 없습니다',
  );
});

test('period and role text', () => {
  expect(careerPeriodText({ startDate: '2020-03-02', endDate: '2023-12-29' })).toBe(
    '2020-03-02 ~ 2023-12-29',
  );
  expect(careerPeriodText({ startDate: '2024-01-02', endDate: null })).toBe('2024-01-02 ~ 재직 중');
  expect(roleText({ department: '백엔드팀', position: null, employmentType: 'contract' })).toBe(
    '백엔드팀 · 계약직',
  );
  expect(roleText({ department: null, position: null, employmentType: 'freelance' })).toBe(
    '프리랜서',
  );
});
