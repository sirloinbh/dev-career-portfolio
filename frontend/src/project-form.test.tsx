import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import type { Project } from './project-data';
import { findLive } from './test/live';
import { parseRequest, unexpectedRequest } from './test/route';
import { type ErrorBody, validation } from './test/server-errors';

// All projects here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const past: Project = {
  id: 1,
  name: '사내 위키 검색',
  organization: '한빛소프트',
  startDate: '2021-03-02',
  endDate: '2021-08-31',
  role: '프론트엔드',
  summary: null,
  contributions: null,
  technologies: ['React', 'Elasticsearch'],
  repositoryUrl: 'https://github.com/example/wiki',
  serviceUrl: null,
};

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with a 400 and that message, as the server would.
 */
function fakeApi(rows: Project[]) {
  const store = [...rows];
  const calls: Call[] = [];
  let refuse: ErrorBody | undefined;
  let deleteFails: { status: number; error: string } | undefined;
  let nextId = 100;
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseRequest(input, init);
      const { method, path: url, id } = request;
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (method === 'GET' && url === '/api/health') return json({ today: '2026-11-05' });
      const known =
        (url === '/api/projects' && (method === 'GET' || method === 'POST')) ||
        (id !== null && url === `/api/projects/${id}` && (method === 'PUT' || method === 'DELETE'));
      if (!known) return unexpectedRequest(request);
      calls.push({ method, url, body });
      if (refuse && (method === 'POST' || method === 'PUT')) {
        const refused = refuse;
        refuse = undefined;
        return json(refused, 400);
      }
      const index = store.findIndex((row) => row.id === id);
      if (method === 'GET') return json({ projects: store });
      // The server stores blank text as NULL.
      const saved = (input: Project) =>
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
        ) as Project;
      if (method === 'POST') {
        const project = saved({ ...(body as Project), id: nextId++ });
        store.unshift(project);
        return json({ project }, 201);
      }
      if (index === -1) return json({ error: 'Project not found' }, 404);
      if (method === 'PUT') {
        store[index] = saved({ ...(body as Project), id: id as number });
        return json({ project: store[index] });
      }
      if (method === 'DELETE' && deleteFails)
        return json({ error: deleteFails.error }, deleteFails.status);
      store.splice(index, 1);
      return Promise.resolve(new Response(null, { status: 204 }));
    }),
  );
  return {
    store,
    calls,
    refuseNext: (body: string | ErrorBody) => {
      refuse = typeof body === 'string' ? { error: body } : body;
    },
    failDeletes: (status: number, error: string) => {
      deleteFails = { status, error };
    },
  };
}

function open(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

const field = (name: string) => screen.getByLabelText(name);
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });
const postBody = (api: { calls: Call[] }) => api.calls.find((call) => call.method === 'POST')?.body;

test('a new project with no end date is sent as running and listed as Ongoing', async () => {
  const api = fakeApi([]);
  open('/projects');
  fireEvent.click(await screen.findByRole('link', { name: 'Add project' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Add project' })).toBeInTheDocument();

  type('Project name', '주문 정산 자동화');
  type('Role', '백엔드 개발');
  type('Start date', '2024-05-01');
  type('Technologies', ' TypeScript, PostgreSQL ,, AWS Lambda, ');
  type('Repository link', 'https://github.com/example/settlement');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/projects');
  expect(postBody(api)).toEqual({
    name: '주문 정산 자동화',
    organization: '',
    startDate: '2024-05-01',
    endDate: null,
    role: '백엔드 개발',
    summary: '',
    contributions: '',
    // Pieces are trimmed and the empty ones from extra commas dropped.
    technologies: ['TypeScript', 'PostgreSQL', 'AWS Lambda'],
    repositoryUrl: 'https://github.com/example/settlement',
    serviceUrl: '',
  });
  const item = await screen.findByRole('listitem', { name: '주문 정산 자동화' });
  expect(item).toHaveTextContent('May 1, 2024 – Present');
  expect(within(item).getByRole('link', { name: /Repository/ })).toHaveAttribute(
    'href',
    'https://github.com/example/settlement',
  );
  expect(await screen.findByText("Added '주문 정산 자동화'")).toBeInTheDocument();
});

test('the hints say how to leave a project running and how to list technologies', async () => {
  fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: 'Add project' });
  expect(field('End date')).toHaveAccessibleDescription(
    'Leave it empty if the project is still running. The list shows "Ongoing".',
  );
  expect(field('Technologies')).toHaveAccessibleDescription(
    'Separate items with commas. Up to 30 items, 50 characters each.',
  );
  expect(field('Repository link')).toHaveAccessibleDescription(
    'Use an address that starts with http:// or https://.',
  );
  expect(field('Repository link')).toHaveAttribute('type', 'url');
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: 'Add project' });
  type('Project name', '사내 위키 검색');
  type('Start date', '2021-03-02');
  type('Repository link', 'github.com/example/wiki');
  api.refuseNext(
    validation(['repositoryUrl', 'Repository link must start with http:// or https://']),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(field('Repository link')).toHaveFocus());
  expect(field('Repository link')).toHaveAttribute('aria-invalid', 'true');
  expect(field('Repository link')).toHaveAccessibleDescription(
    expect.stringContaining('Repository link must start with http:// or https://'),
  );
  expect(field('Service link')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('Project name')).toHaveValue('사내 위키 검색');
  expect(window.location.pathname).toBe('/projects/new');
});

test('a half-typed end date is sent as text the server refuses, not as running', async () => {
  const api = fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: 'Add project' });
  // A browser reads an unfinished date ("2023-12-__") as '' and flags it as bad input.
  Object.defineProperty(field('End date'), 'validity', { value: { badInput: true } });
  api.refuseNext(validation(['endDate', 'End date must be a date in YYYY-MM-DD format']));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('End date')).toHaveFocus());
  expect(postBody(api)).toMatchObject({ endDate: 'incomplete' });
});

test('a project is edited with its saved values filled in', async () => {
  const api = fakeApi([past]);
  open('/projects');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit 사내 위키 검색' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Edit project' }),
  ).toBeInTheDocument();
  // The heading shows while the item loads; the fields come with the form.
  await screen.findByRole('button', { name: 'Save' });
  expect(window.location.pathname).toBe('/projects/1/edit');
  expect(field('Project name')).toHaveValue('사내 위키 검색');
  expect(field('End date')).toHaveValue('2021-08-31');
  expect(field('Technologies')).toHaveValue('React, Elasticsearch');
  expect(field('Repository link')).toHaveValue('https://github.com/example/wiki');
  expect(field('Service link')).toHaveValue('');

  type('Technologies', 'React, Elasticsearch, Redis');
  type('Repository link', '');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/projects/1');
  expect(put?.body).toMatchObject({
    technologies: ['React', 'Elasticsearch', 'Redis'],
    repositoryUrl: '',
    endDate: '2021-08-31',
  });
  const item = await screen.findByRole('listitem', { name: '사내 위키 검색' });
  expect(item).toHaveTextContent('Redis');
  // The cleared link is gone from the list.
  expect(within(item).queryByRole('link', { name: /Repository/ })).not.toBeInTheDocument();
});

test('a refused edit shows the message under its field and stays on the form', async () => {
  const api = fakeApi([past]);
  open('/projects/1/edit');
  await screen.findByRole('heading', { level: 1, name: 'Edit project' });
  await screen.findByRole('button', { name: 'Save' });
  type('Start date', '2022-01-03');
  api.refuseNext(validation(['endDate', 'End date cannot be earlier than start date']));
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(field('End date')).toHaveFocus());
  expect(field('End date')).toHaveAccessibleDescription(
    expect.stringContaining('End date cannot be earlier than start date'),
  );
  expect(api.calls.find((call) => call.method === 'PUT')?.url).toBe('/api/projects/1');
  expect(field('Start date')).toHaveValue('2022-01-03');
  expect(window.location.pathname).toBe('/projects/1/edit');
});

test('saving a project deleted after the form opened says it is gone', async () => {
  const api = fakeApi([past]);
  open('/projects/1/edit');
  await screen.findByRole('heading', { level: 1, name: 'Edit project' });
  await screen.findByRole('button', { name: 'Save' });
  // Someone else deleted it after the form loaded.
  api.store.splice(0, 1);
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await findLive('alert')).toHaveTextContent('Project not found');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus());
  expect(window.location.pathname).toBe('/projects/1/edit');
});

test('clearing the end date of a finished project makes it Ongoing', async () => {
  const api = fakeApi([past]);
  open('/projects/1/edit');
  await screen.findByRole('heading', { level: 1, name: 'Edit project' });
  await screen.findByRole('button', { name: 'Save' });
  type('End date', '');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const item = await screen.findByRole('listitem', { name: '사내 위키 검색' });
  expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ endDate: null });
  expect(item).toHaveTextContent('March 2, 2021 – Present');
});

test('cancelling the delete dialog keeps the project', async () => {
  const api = fakeApi([past]);
  open('/projects');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 사내 위키 검색' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this project?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: '사내 위키 검색' })).toBeInTheDocument();
});

test('confirming the delete removes the project and moves focus to the page title', async () => {
  const api = fakeApi([past]);
  open('/projects');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 사내 위키 검색' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this project?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('heading', { name: 'No projects added yet' })).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/projects/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("Deleted '사내 위키 검색'")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([past]);
  api.failDeletes(503, 'Cannot connect to the database');
  open('/projects');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 사내 위키 검색' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this project?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByText('Could not delete the project. Cannot connect to the database'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete this project?' })).toBeInTheDocument();
  expect(
    screen.getByRole('listitem', { hidden: true, name: '사내 위키 검색' }),
  ).toBeInTheDocument();
});
