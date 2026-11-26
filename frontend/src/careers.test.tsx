import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { type Career, careerPeriodText, roleText } from './career-data';
import type { Project } from './project-data';
import { findLive, getLive } from './test/live';

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

/** Projects the fake API lists: one linked to `current`, one linked to nothing. */
let linkedProjects: Project[] = [];

/** Answers /api/careers with `careers` (or an error) and /api/health with a date. */
function serve(careers: { status: number; body: object } | 'offline') {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-05' })));
      }
      if (url === '/api/projects') {
        return Promise.resolve(new Response(JSON.stringify({ projects: linkedProjects })));
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
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Career' }));
  expect(window.location.pathname).toBe('/careers');
  expect(await screen.findByRole('heading', { level: 1, name: 'Career' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Career' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('careers are listed in the order the API gives, not re-sorted', async () => {
  // Deliberately oldest first: the screen must keep the server's order.
  serve({ status: 200, body: { careers: [past, current] } });
  openCareers();
  const list = await screen.findByRole('list', { name: 'Career list' });
  expect(getLive('status')).toHaveTextContent('2 entries');
  expect(screen.getByRole('region', { name: 'Career' })).toHaveAttribute('aria-busy', 'false');
  const items = within(list).getAllByRole('listitem');
  expect(items.map((item) => within(item).getByRole('heading', { level: 2 }).textContent)).toEqual([
    '새벽랩',
    '한빛소프트',
  ]);
});

/** The badge text next to a company name, if any. */
const badgeOf = (item: HTMLElement) => item.querySelector('[data-slot="badge"]')?.textContent;

test('a job still held shows "Current"; a finished one does not', async () => {
  serve({ status: 200, body: { careers: [current, past] } });
  openCareers();
  const list = await screen.findByRole('list', { name: 'Career list' });

  const held = within(list).getByRole('listitem', { name: '한빛소프트' });
  expect(badgeOf(held)).toBe('Current');
  expect(held).toHaveTextContent('플랫폼팀 · 선임 · Full-time');
  expect(held).toHaveTextContent('January 2, 2024 – Present');
  // Each label is the term of its own text, so a screen reader can tell the blocks apart.
  expect(
    within(held)
      .getAllByRole('term')
      .map((term) => term.textContent),
  ).toEqual(['Duties', 'Achievements']);
  expect(
    within(held)
      .getAllByRole('definition')
      .map((text) => text.textContent),
  ).toEqual(['결제 API 개발', '응답 시간 40% 단축']);

  const finished = within(list).getByRole('listitem', { name: '새벽랩' });
  expect(badgeOf(finished)).toBeUndefined();
  expect(finished).not.toHaveTextContent('Current');
  expect(finished).toHaveTextContent('Intern');
  expect(finished).toHaveTextContent('July 1, 2019 – December 31, 2019');
  // Blank duties and achievements leave no empty labels behind.
  expect(finished).not.toHaveTextContent('Duties');
  expect(finished).not.toHaveTextContent('Achievements');
  expect(within(finished).queryByRole('term')).not.toBeInTheDocument();
});

test('a placeholder shows while the list loads', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => {})),
  );
  openCareers();
  expect(getLive('status')).toHaveTextContent('Loading career');
  expect(screen.getByRole('region', { name: 'Career' })).toHaveAttribute('aria-busy', 'true');
});

test('an empty list explains what will appear', async () => {
  serve({ status: 200, body: { careers: [] } });
  openCareers();
  expect(await screen.findByRole('heading', { name: 'No career added yet' })).toBeInTheDocument();
  expect(getLive('status')).toHaveTextContent('0 entries');
  expect(screen.queryByRole('list', { name: 'Career list' })).not.toBeInTheDocument();
});

test('a server error is shown in English', async () => {
  serve({ status: 503, body: { error: 'Cannot connect to the database' } });
  openCareers();
  expect(await findLive('alert')).toHaveTextContent(
    'Could not load career. Cannot connect to the database',
  );
});

test('an error without a server message still says what failed', async () => {
  serve({ status: 502, body: {} });
  openCareers();
  expect(await findLive('alert')).toHaveTextContent(
    'Could not load career. Could not process the request',
  );
});

test('an unreachable server is shown in English', async () => {
  serve('offline');
  openCareers();
  expect(await findLive('alert')).toHaveTextContent(
    'Could not load career. Cannot reach the server',
  );
});

test('period and role text', () => {
  expect(careerPeriodText({ startDate: '2020-03-02', endDate: '2023-12-29' })).toBe(
    'March 2, 2020 – December 29, 2023',
  );
  expect(careerPeriodText({ startDate: '2024-01-02', endDate: null })).toBe(
    'January 2, 2024 – Present',
  );
  expect(roleText({ department: '백엔드팀', position: null, employmentType: 'contract' })).toBe(
    '백엔드팀 · Contract',
  );
  expect(roleText({ department: null, position: null, employmentType: 'freelance' })).toBe(
    'Freelance',
  );
});

/** GET /api/careers answers the queued responses in turn; DELETE succeeds. */
function serveReloads(...gets: Array<{ status: number; body: object }>) {
  const queue = [...gets];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-05' })));
      }
      if (init?.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      if (String(input) === '/api/projects') {
        return Promise.resolve(new Response(JSON.stringify({ projects: [] })));
      }
      const next = queue.shift() ?? gets[gets.length - 1];
      return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status }));
    }),
  );
}

async function deleteCurrentCareer() {
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛소프트' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this career?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
}

test('a failed reload after a delete says the list may be out of date and can be retried', async () => {
  serveReloads(
    { status: 200, body: { careers: [current, past] } },
    // The shared query layer retries a 5xx once (#152), so the refresh fails only when both tries do.
    { status: 500, body: { error: 'Server error' } },
    { status: 500, body: { error: 'Server error' } },
    { status: 200, body: { careers: [past] } },
  );
  openCareers();
  await deleteCurrentCareer();
  const alert = await findLive('alert');
  expect(alert).toHaveTextContent('Could not refresh career. The list below may be out of date.');
  // The delete shows at once, and the remaining row stays on screen.
  expect(screen.queryByRole('listitem', { name: '한빛소프트' })).not.toBeInTheDocument();
  expect(screen.getByRole('listitem', { name: '새벽랩' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull());
  expect(screen.getByRole('listitem', { name: '새벽랩' })).toBeInTheDocument();
});

test('the Edit screen reuses the list it came from instead of loading it again (#152)', async () => {
  serveReloads({ status: 200, body: { careers: [current, past] } });
  openCareers();
  fireEvent.click(await screen.findByRole('link', { name: 'Edit 한빛소프트' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Edit career' })).toBeInTheDocument();
  expect(await screen.findByDisplayValue('한빛소프트')).toBeInTheDocument();
  const listGets = vi
    .mocked(fetch)
    .mock.calls.filter(
      ([input, init]) => String(input) === '/api/careers' && (init?.method ?? 'GET') === 'GET',
    );
  expect(listGets).toHaveLength(1);
});

test('the top of the list shows the total experience and the internship time apart', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-27T03:00:00Z') });
  try {
    serve({ status: 200, body: { careers: [current, past] } });
    openCareers();
    await screen.findByRole('list', { name: 'Career list' });
    // 2024-01-02 up to 2026-11-27 is 2 years 10 months; the 2019 internship is 6 months, apart.
    expect(screen.getByText('Total experience').nextElementSibling).toHaveTextContent(
      '2 years 10 months',
    );
    expect(screen.getByText('Internships (not in the total)').nextElementSibling).toHaveTextContent(
      '6 months',
    );
  } finally {
    vi.useRealTimers();
  }
});

test('searching or filtering the list keeps the total experience unchanged (#259)', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-27T03:00:00Z') });
  try {
    serve({ status: 200, body: { careers: [current, past] } });
    openCareers();
    await screen.findByRole('list', { name: 'Career list' });
    const total = () => screen.getByText('Total experience').nextElementSibling;
    expect(total()).toHaveTextContent('2 years 10 months');
    fireEvent.change(screen.getByLabelText('Employment type'), { target: { value: 'intern' } });
    // Only the internship is listed, yet the total still counts every career.
    expect(
      within(screen.getByRole('list', { name: 'Career list' })).getAllByRole('listitem'),
    ).toHaveLength(1);
    expect(total()).toHaveTextContent('2 years 10 months');
  } finally {
    vi.useRealTimers();
  }
});

test('a career lists the projects linked to it, and a project with no link appears nowhere', async () => {
  const project = (id: number, name: string, careerId: number | null): Project => ({
    id,
    name,
    organization: null,
    careerId,
    startDate: '2024-02-01',
    endDate: null,
    role: null,
    summary: null,
    contributions: null,
    technologies: [],
    repositoryUrl: null,
    serviceUrl: null,
  });
  linkedProjects = [project(7, '결제 리뉴얼', current.id), project(8, 'Side project', null)];
  try {
    serve({ status: 200, body: { careers: [current, past] } });
    openCareers();
    const list = await screen.findByRole('list', { name: 'Career list' });
    const held = within(list).getByRole('listitem', { name: '한빛소프트' });
    const linked = await within(held).findByRole('list', { name: 'Linked projects' });
    expect(within(linked).getByRole('link', { name: '결제 리뉴얼' })).toHaveAttribute(
      'href',
      '/projects/7/edit',
    );
    expect(linked).toHaveTextContent('February 1, 2024 – Present');
    // The other career has no linked project, so it shows no Projects block.
    expect(
      within(within(list).getByRole('listitem', { name: '새벽랩' })).queryByText('Projects'),
    ).toBeNull();
    expect(screen.queryByText('Side project')).not.toBeInTheDocument();
  } finally {
    linkedProjects = [];
  }
});
