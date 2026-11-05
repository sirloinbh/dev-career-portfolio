import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { groupSkills, proficiencyText, type Skill } from './skill-data';

// All skills here are made up for the test.

const skill = (id: number, name: string, category: Skill['category'], proficiency: number) => ({
  id,
  name,
  category,
  proficiency,
  memo: null,
});

const typescript: Skill = { ...skill(1, 'TypeScript', 'language', 5), memo: '실무 4년' };
const go = skill(2, 'Go', 'language', 3);
const postgres = skill(3, 'PostgreSQL', 'database', 4);
const docker = skill(4, 'Docker', 'infrastructure', 2);

/** Answers /api/skills with `skills` (or an error) and /api/health with a date. */
function serve(skills: { status: number; body: object } | 'offline') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-05' })));
      }
      if (skills === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(new Response(JSON.stringify(skills.body), { status: skills.status }));
    }),
  );
}

/** The skills listed under a category heading such as "언어 2건". */
const groupList = (heading: string) =>
  within(
    screen.getByRole('heading', { level: 2, name: heading }).parentElement as HTMLElement,
  ).getByRole('list');

function openSkills() {
  window.history.replaceState(null, '', '/skills');
  render(<App />);
}

test('the main menu leads to the skill list', async () => {
  serve({ status: 200, body: { skills: [] } });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: '주 메뉴' });
  fireEvent.click(within(menu).getByRole('link', { name: '스킬' }));
  expect(window.location.pathname).toBe('/skills');
  expect(await screen.findByRole('heading', { level: 1, name: '스킬' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: '스킬' })).toHaveAttribute('aria-current', 'page');
});

test('skills are grouped by category in the fixed order, empty categories left out', async () => {
  // Deliberately out of category order: the groups must follow the fixed order.
  serve({ status: 200, body: { skills: [docker, typescript, go, postgres] } });
  openSkills();
  await screen.findByRole('heading', { level: 2, name: '언어 2건' });
  expect(screen.getByRole('status')).toHaveTextContent('스킬 4건');
  expect(screen.getByRole('region', { name: '스킬' })).toHaveAttribute('aria-busy', 'false');
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
  ).toEqual(['언어 2건', '데이터베이스 1건', '인프라·클라우드 1건']);
  // Groups are not landmarks, so the landmark list is not crowded with six categories.
  expect(screen.queryByRole('region', { name: /언어/ })).not.toBeInTheDocument();
  const languages = groupList('언어 2건');
  expect(
    within(languages)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(['TypeScript', 'Go']);
  expect(screen.queryByRole('heading', { name: /프레임워크/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /도구/ })).not.toBeInTheDocument();
});

test('a skill shows its proficiency as dots, a short count and a full sentence', async () => {
  serve({ status: 200, body: { skills: [typescript, go] } });
  openSkills();
  const item = await screen.findByRole('listitem', { name: 'TypeScript' });
  expect(within(item).getByText('숙련도 5점 중 5점, 전문')).toHaveClass('sr-only');
  // The short count is for the eye only; a screen reader hears the sentence alone.
  expect(within(item).getByText('5/5 · 전문')).toHaveAttribute('aria-hidden', 'true');
  const weaker = screen.getByRole('listitem', { name: 'Go' });
  expect(within(weaker).getByText('숙련도 5점 중 3점, 실무')).toBeInTheDocument();
  // Three of the five dots are filled.
  const dots = weaker.querySelectorAll('[aria-hidden] > span');
  expect(dots).toHaveLength(5);
  expect([...dots].filter((dot) => dot.classList.contains('bg-foreground'))).toHaveLength(3);
});

test('a memo is shown with its label only when it was entered', async () => {
  serve({ status: 200, body: { skills: [typescript, go] } });
  openSkills();
  const withMemo = await screen.findByRole('listitem', { name: 'TypeScript' });
  expect(within(withMemo).getByRole('term')).toHaveTextContent('메모');
  expect(within(withMemo).getByRole('definition')).toHaveTextContent('실무 4년');
  const withoutMemo = screen.getByRole('listitem', { name: 'Go' });
  expect(within(withoutMemo).queryByRole('term')).not.toBeInTheDocument();
});

test('a placeholder shows while the list loads', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openSkills();
  expect(screen.getByRole('status')).toHaveTextContent('스킬을 불러오는 중');
  expect(screen.getByRole('region', { name: '스킬' })).toHaveAttribute('aria-busy', 'true');
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { skills: [] } });
  openSkills();
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 스킬이 없습니다' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('스킬 0건');
  expect(screen.queryByRole('heading', { level: 2, name: /건$/ })).not.toBeInTheDocument();
});

test('a server error is shown in Korean', async () => {
  serve({ status: 503, body: { error: '데이터베이스에 연결할 수 없습니다' } });
  openSkills();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '스킬을 불러오지 못했습니다. 데이터베이스에 연결할 수 없습니다',
  );
});

test('an error without a server message still says what failed', async () => {
  serve({ status: 502, body: {} });
  openSkills();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '스킬을 불러오지 못했습니다. 요청을 처리하지 못했습니다',
  );
});

test('an unreachable server is shown in Korean', async () => {
  serve('offline');
  openSkills();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '스킬을 불러오지 못했습니다. 서버에 연결할 수 없습니다',
  );
});

test('grouping keeps the API order within a group', () => {
  expect(groupSkills([])).toEqual([]);
  const groups = groupSkills([postgres, go, typescript]);
  expect(groups.map((group) => group.category)).toEqual(['language', 'database']);
  // The API sends the strongest first; the screen does not re-sort.
  expect(groups[0].skills.map((item) => item.name)).toEqual(['Go', 'TypeScript']);
  expect(proficiencyText(1)).toBe('숙련도 5점 중 1점, 입문');
});
