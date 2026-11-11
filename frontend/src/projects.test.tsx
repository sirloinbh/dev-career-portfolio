import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { type Project, projectPeriodText, projectRoleText } from './project-data';
import { webLink } from './web-link';

// All projects here are made up for the test.

const running: Project = {
  id: 2,
  name: '주문 정산 자동화',
  organization: '한빛소프트',
  startDate: '2024-05-01',
  endDate: null,
  role: '백엔드 개발',
  summary: '월말 정산을 배치로 옮긴 프로젝트',
  contributions: '정산 시간 6시간 → 40분\n대사 오류 0건',
  technologies: ['TypeScript', 'PostgreSQL', 'AWS Lambda'],
  repositoryUrl: 'https://github.com/example/settlement',
  serviceUrl: 'https://settlement.example.com',
};

const finished: Project = {
  id: 1,
  name: '사내 위키 검색',
  organization: null,
  startDate: '2021-03-02',
  endDate: '2021-08-31',
  role: null,
  summary: null,
  contributions: null,
  technologies: [],
  repositoryUrl: null,
  serviceUrl: null,
};

/** Answers /api/projects with `projects` (or an error) and /api/health with a date. */
function serve(projects: { status: number; body: object } | 'offline') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-05' })));
      }
      if (projects === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      return Promise.resolve(
        new Response(JSON.stringify(projects.body), { status: projects.status }),
      );
    }),
  );
}

function openProjects() {
  window.history.replaceState(null, '', '/projects');
  render(<App />);
}

/** The project rows only, not the technology tags listed inside them. */
const rowsOf = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement === list);

test('the main menu leads to the project list', async () => {
  serve({ status: 200, body: { projects: [] } });
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Projects' }));
  expect(window.location.pathname).toBe('/projects');
  expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Projects' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('projects are listed in the order the API gives, not re-sorted', async () => {
  // Deliberately oldest first: the screen must keep the server's order.
  serve({ status: 200, body: { projects: [finished, running] } });
  openProjects();
  const list = await screen.findByRole('list', { name: 'Project list' });
  expect(screen.getByRole('status')).toHaveTextContent('2 entries');
  expect(screen.getByRole('region', { name: 'Projects' })).toHaveAttribute('aria-busy', 'false');
  expect(
    rowsOf(list).map((item) => within(item).getByRole('heading', { level: 2 }).textContent),
  ).toEqual(['사내 위키 검색', '주문 정산 자동화']);
});

/** The "Ongoing" badge in a row, if any (the technology tags are badges too, so match the text). */
const runningBadge = (item: HTMLElement) =>
  within(item).queryByText('Ongoing', { selector: '[data-slot="badge"]' });

test('a running project shows "Ongoing" and every block that was filled in', async () => {
  serve({ status: 200, body: { projects: [running, finished] } });
  openProjects();
  const list = await screen.findByRole('list', { name: 'Project list' });

  const item = within(list).getByRole('listitem', { name: '주문 정산 자동화' });
  expect(runningBadge(item)).toBeInTheDocument();
  expect(item).toHaveTextContent('한빛소프트 · 백엔드 개발');
  expect(item).toHaveTextContent('May 1, 2024 – Present');
  // Each label is the term of its own block, so a screen reader can tell the blocks apart.
  expect(
    within(item)
      .getAllByRole('term')
      .map((term) => term.textContent),
  ).toEqual(['Summary', 'Contributions', 'Technologies']);
  const [summary, contributions, technologies] = within(item).getAllByRole('definition');
  expect(summary).toHaveTextContent('월말 정산을 배치로 옮긴 프로젝트');
  // Line breaks are kept as typed.
  expect(contributions.textContent).toBe('정산 시간 6시간 → 40분\n대사 오류 0건');
  expect(
    within(technologies)
      .getAllByRole('listitem')
      .map((tag) => tag.textContent),
  ).toEqual(['TypeScript', 'PostgreSQL', 'AWS Lambda']);

  const repository = within(item).getByRole('link', {
    name: 'Repository of 주문 정산 자동화 (opens in a new tab)',
  });
  expect(repository).toHaveAttribute('href', 'https://github.com/example/settlement');
  expect(repository).toHaveAttribute('target', '_blank');
  expect(repository).toHaveAttribute('rel', 'noopener noreferrer');
  expect(
    within(item).getByRole('link', { name: 'Service of 주문 정산 자동화 (opens in a new tab)' }),
  ).toHaveAttribute('href', 'https://settlement.example.com');
});

test('a finished project with only the required fields shows no empty labels', async () => {
  serve({ status: 200, body: { projects: [running, finished] } });
  openProjects();
  const list = await screen.findByRole('list', { name: 'Project list' });
  const item = within(list).getByRole('listitem', { name: '사내 위키 검색' });
  expect(runningBadge(item)).not.toBeInTheDocument();
  expect(item).not.toHaveTextContent('Ongoing');
  expect(item).toHaveTextContent('March 2, 2021 – August 31, 2021');
  expect(within(item).queryByRole('term')).not.toBeInTheDocument();
  expect(within(item).queryByRole('link', { name: /opens in a new tab/ })).not.toBeInTheDocument();
  // The name, then the period: no blank organization line between them.
  expect(item.querySelectorAll('p')).toHaveLength(1);
});

test('a link that is not a web address is not made clickable', async () => {
  serve({
    status: 200,
    body: {
      projects: [{ ...finished, repositoryUrl: 'javascript:alert(1)', serviceUrl: 'ftp://x' }],
    },
  });
  openProjects();
  const item = await screen.findByRole('listitem', { name: '사내 위키 검색' });
  expect(within(item).queryByRole('link', { name: /opens in a new tab/ })).not.toBeInTheDocument();
});

test('a placeholder shows while the list loads', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openProjects();
  expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
  expect(screen.getByRole('region', { name: 'Projects' })).toHaveAttribute('aria-busy', 'true');
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { projects: [] } });
  openProjects();
  expect(await screen.findByRole('heading', { name: 'No projects added yet' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('0 entries');
  expect(screen.queryByRole('list', { name: 'Project list' })).not.toBeInTheDocument();
});

test('a server error is shown in English', async () => {
  serve({ status: 503, body: { error: 'Cannot connect to the database' } });
  openProjects();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load projects. Cannot connect to the database',
  );
});

test('an error without a server message still says what failed', async () => {
  serve({ status: 502, body: {} });
  openProjects();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load projects. Could not process the request',
  );
});

test('an unreachable server is shown in English', async () => {
  serve('offline');
  openProjects();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not load projects. Cannot reach the server',
  );
});

test('each link is checked on its own: a valid one is shown, an invalid one is not', async () => {
  serve({
    status: 200,
    body: {
      projects: [
        {
          ...finished,
          repositoryUrl: 'https://github.com/example/wiki',
          serviceUrl: 'javascript:alert(1)',
        },
      ],
    },
  });
  openProjects();
  const item = await screen.findByRole('listitem', { name: '사내 위키 검색' });
  const links = within(item).getAllByRole('link', { name: /opens in a new tab/ });
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAccessibleName('Repository of 사내 위키 검색 (opens in a new tab)');
  expect(links[0]).toHaveAttribute('href', 'https://github.com/example/wiki');
});

test('period, role and link rules', () => {
  expect(projectPeriodText({ startDate: '2021-03-02', endDate: '2021-08-31' })).toBe(
    'March 2, 2021 – August 31, 2021',
  );
  expect(projectPeriodText({ startDate: '2024-05-01', endDate: null })).toBe(
    'May 1, 2024 – Present',
  );
  expect(projectRoleText({ organization: '한빛소프트', role: null })).toBe('한빛소프트');
  expect(projectRoleText({ organization: null, role: '백엔드 개발' })).toBe('백엔드 개발');
  expect(projectRoleText({ organization: null, role: null })).toBe('');
  expect(webLink('HTTPS://example.com')).toBe('HTTPS://example.com');
  expect(webLink('javascript:alert(1)')).toBeNull();
  expect(webLink(null)).toBeNull();
});
