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

/** The skills listed under a category heading such as "Language 2 entries". */
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
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Skills' }));
  expect(window.location.pathname).toBe('/skills');
  expect(await screen.findByRole('heading', { level: 1, name: 'Skills' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Skills' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('skills are grouped by category in the fixed order, empty categories left out', async () => {
  // Deliberately out of category order: the groups must follow the fixed order.
  serve({ status: 200, body: { skills: [docker, typescript, go, postgres] } });
  openSkills();
  await screen.findByRole('heading', { level: 2, name: 'Language 2 entries' });
  expect(screen.getByRole('status')).toHaveTextContent('4 entries');
  expect(screen.getByRole('region', { name: 'Skills' })).toHaveAttribute('aria-busy', 'false');
  expect(
    screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
  ).toEqual(['Language 2 entries', 'Database 1 entry', 'Infrastructure / cloud 1 entry']);
  // Groups are not landmarks, so the landmark list is not crowded with six categories.
  expect(screen.queryByRole('region', { name: /Language/ })).not.toBeInTheDocument();
  const languages = groupList('Language 2 entries');
  expect(
    within(languages)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent),
  ).toEqual(['TypeScript', 'Go']);
  expect(screen.queryByRole('heading', { name: /프레임워크/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Tool/ })).not.toBeInTheDocument();
});

test('a skill shows its proficiency as dots, a short count and a full sentence', async () => {
  serve({ status: 200, body: { skills: [typescript, go] } });
  openSkills();
  const item = await screen.findByRole('listitem', { name: 'TypeScript' });
  expect(within(item).getByText('Proficiency 5 of 5, Expert')).toHaveClass('sr-only');
  // The short count is for the eye only; a screen reader hears the sentence alone.
  expect(within(item).getByText('5/5 · Expert')).toHaveAttribute('aria-hidden', 'true');
  const weaker = screen.getByRole('listitem', { name: 'Go' });
  expect(within(weaker).getByText('Proficiency 3 of 5, Working')).toBeInTheDocument();
  // Three of the five dots are filled.
  const dots = weaker.querySelectorAll('[aria-hidden] > span');
  expect(dots).toHaveLength(5);
  expect([...dots].filter((dot) => dot.classList.contains('bg-foreground'))).toHaveLength(3);
});

test('a memo is shown with its label only when it was entered', async () => {
  serve({ status: 200, body: { skills: [typescript, go] } });
  openSkills();
  const withMemo = await screen.findByRole('listitem', { name: 'TypeScript' });
  expect(within(withMemo).getByRole('term')).toHaveTextContent('Notes');
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
  expect(screen.getByRole('status')).toHaveTextContent('Loading skills');
  expect(screen.getByRole('region', { name: 'Skills' })).toHaveAttribute('aria-busy', 'true');
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { skills: [] } });
  openSkills();
  expect(await screen.findByRole('heading', { name: 'No skills added yet' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('0 entries');
  expect(screen.queryByRole('heading', { level: 2, name: /entr(y|ies)$/ })).not.toBeInTheDocument();
});

test('a server error is shown in English', async () => {
  serve({ status: 503, body: { error: 'Cannot connect to the database' } });
  openSkills();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load skills. Cannot connect to the database',
  );
});

test('an error without a server message still says what failed', async () => {
  serve({ status: 502, body: {} });
  openSkills();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load skills. Could not process the request',
  );
});

test('an unreachable server is shown in English', async () => {
  serve('offline');
  openSkills();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load skills. Cannot reach the server',
  );
});

test('grouping keeps the API order within a group', () => {
  expect(groupSkills([])).toEqual([]);
  const groups = groupSkills([postgres, go, typescript]);
  expect(groups.map((group) => group.category)).toEqual(['language', 'database']);
  // The API sends the strongest first; the screen does not re-sort.
  expect(groups[0].skills.map((item) => item.name)).toEqual(['Go', 'TypeScript']);
  expect(proficiencyText(1)).toBe('Proficiency 1 of 5, Beginner');
});
