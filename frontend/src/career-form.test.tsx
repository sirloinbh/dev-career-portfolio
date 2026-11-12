import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import {
  type Career,
  careerFieldErrors,
  emptyCareerForm,
  toCareerForm,
  toCareerInput,
} from './career-data';
import { toast } from './components/ui/sonner';

// All companies here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const past: Career = {
  id: 1,
  company: '한빛소프트',
  department: '커머스개발팀',
  position: '주임',
  employmentType: 'full_time',
  startDate: '2019-02-11',
  endDate: '2023-12-29',
  duties: '주문 API 개발',
  achievements: null,
};

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with a 400 and that message, as the server would.
 */
function fakeApi(rows: Career[]) {
  const store = [...rows];
  const calls: Call[] = [];
  let refuse: string | undefined;
  let deleteFails: { status: number; error: string } | undefined;
  let nextId = 100;
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (url === '/api/health') return json({ today: '2026-11-05' });
      calls.push({ method, url, body });
      if (refuse && (method === 'POST' || method === 'PUT')) {
        const error = refuse;
        refuse = undefined;
        return json({ error }, 400);
      }
      const id = Number(url.split('/')[3]);
      const index = store.findIndex((row) => row.id === id);
      if (method === 'GET') return json({ careers: store });
      // The server stores blank text as NULL.
      const saved = (input: Career) =>
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
        ) as Career;
      if (method === 'POST') {
        const career = saved({ ...(body as Career), id: nextId++ });
        store.unshift(career);
        return json({ career }, 201);
      }
      if (index === -1) return json({ error: 'Career not found' }, 404);
      if (method === 'PUT') {
        store[index] = saved({ ...(body as Career), id });
        return json({ career: store[index] });
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
    refuseNext: (message: string) => {
      refuse = message;
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

test('a new career with no end date is sent as a job still held and listed as Current', async () => {
  const api = fakeApi([]);
  open('/careers');
  fireEvent.click(await screen.findByRole('link', { name: 'Add career' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Add career' })).toBeInTheDocument();

  type('Company', '구름데이터');
  type('Job title', '선임 개발자');
  fireEvent.change(field('Employment type'), { target: { value: 'contract' } });
  type('Start date', '2024-01-02');
  type('Duties', '데이터 수집 API');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'Career' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/careers');
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    company: '구름데이터',
    department: '',
    position: '선임 개발자',
    employmentType: 'contract',
    startDate: '2024-01-02',
    endDate: null,
    duties: '데이터 수집 API',
    achievements: '',
  });
  const list = await screen.findByRole('list', { name: 'Career list' });
  const item = within(list).getByRole('listitem', { name: '구름데이터' });
  expect(item).toHaveTextContent('January 2, 2024 – Present');
  expect(item).toHaveTextContent('선임 개발자 · Contract');
});

test('the end date hint says an empty date means a job still held', async () => {
  fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: 'Add career' });
  expect(field('End date')).toHaveAccessibleDescription(
    'Leave it empty if you still work here. The list shows "Current".',
  );
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: 'Add career' });
  type('Company', '한빛소프트');
  type('Start date', '2023-03-02');
  type('End date', '2020-02-28');
  api.refuseNext('End date cannot be earlier than start date');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(field('End date')).toHaveAttribute('aria-invalid', 'true'));
  expect(field('End date')).toHaveAccessibleDescription(
    expect.stringContaining('End date cannot be earlier than start date'),
  );
  await waitFor(() => expect(field('End date')).toHaveFocus());
  expect(field('Start date')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('Company')).toHaveValue('한빛소프트');
  expect(window.location.pathname).toBe('/careers/new');
});

test('each joined server message is shown under its own field, topmost focused', async () => {
  const api = fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: 'Add career' });
  api.refuseNext('Start date must be a date in YYYY-MM-DD format, Company is required');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Company')).toHaveFocus());
  expect(field('Company')).toHaveAccessibleDescription('Company is required');
  expect(field('Start date')).toHaveAccessibleDescription(
    'Start date must be a date in YYYY-MM-DD format',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: 'Add career' });
  api.refuseNext('Input contains a character that is not allowed (NUL)');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Input contains a character that is not allowed (NUL)',
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus());
});

test('a career is edited with its saved values filled in', async () => {
  const api = fakeApi([past]);
  open('/careers');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit 한빛소프트' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Edit career' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/careers/1/edit');
  expect(field('Company')).toHaveValue('한빛소프트');
  expect(field('Employment type')).toHaveValue('full_time');
  expect(field('End date')).toHaveValue('2023-12-29');
  expect(field('Achievements')).toHaveValue('');

  type('Achievements', '정산 배치 시간 단축');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Career' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/careers/1');
  expect(put?.body).toMatchObject({ achievements: '정산 배치 시간 단축', endDate: '2023-12-29' });
  expect(await screen.findByText('정산 배치 시간 단축')).toBeInTheDocument();
});

test('clearing the end date of a past job makes it Current', async () => {
  const api = fakeApi([past]);
  open('/careers/1/edit');
  await screen.findByRole('heading', { level: 1, name: 'Edit career' });
  type('End date', '');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const item = await screen.findByRole('listitem', { name: '한빛소프트' });
  expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ endDate: null });
  expect(item).toHaveTextContent('February 11, 2019 – Present');
});

test('editing a career that no longer exists says so', async () => {
  fakeApi([]);
  open('/careers/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('Career not found');
});

test('cancelling the delete dialog keeps the career', async () => {
  const api = fakeApi([past]);
  open('/careers');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛소프트' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this career?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: '한빛소프트' })).toBeInTheDocument();
});

test('confirming the delete removes the career and moves focus to the page title', async () => {
  const api = fakeApi([past]);
  open('/careers');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛소프트' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this career?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('heading', { name: 'No career added yet' })).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/careers/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("Deleted '한빛소프트'")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: 'Career' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([past]);
  api.failDeletes(503, 'Cannot connect to the database');
  open('/careers');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛소프트' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this career?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByText('Could not delete the career. Cannot connect to the database'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete this career?' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { hidden: true, name: '한빛소프트' })).toBeInTheDocument();
});

test('a row that is already gone (404) counts as deleted', async () => {
  const api = fakeApi([past]);
  api.failDeletes(404, 'Career not found');
  open('/careers');
  await screen.findByRole('listitem', { name: '한빛소프트' });
  // Someone else deleted it after the list loaded.
  api.store.splice(0, 1);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛소프트' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this career?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('listitem', { name: '한빛소프트' })).not.toBeInTheDocument();
  expect(await screen.findByText("Deleted '한빛소프트'")).toBeInTheDocument();
  expect(screen.queryByText(/Could not delete/)).not.toBeInTheDocument();
});

test('a half-typed end date is sent as text the server refuses, not as a job still held', async () => {
  const api = fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: 'Add career' });
  type('Company', '한빛소프트');
  type('Start date', '2023-03-02');
  // A browser reads an unfinished date ("2023-12-__") as '' and flags it as bad input.
  Object.defineProperty(field('End date'), 'validity', { value: { badInput: true } });
  api.refuseNext('End date must be a date in YYYY-MM-DD format');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('End date')).toHaveFocus());
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    endDate: 'incomplete',
  });
  expect(field('End date')).toHaveAccessibleDescription(
    expect.stringContaining('End date must be a date in YYYY-MM-DD format'),
  );
  expect(api.store).toHaveLength(0);
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => careerFieldErrors(message)[0]?.field;
  expect(fieldOf('Company is required')).toBe('company');
  expect(fieldOf('Department must be at most 100 characters')).toBe('department');
  expect(fieldOf('Job title must be at most 100 characters')).toBe('position');
  expect(fieldOf('Start date must be a date in YYYY-MM-DD format')).toBe('startDate');
  expect(fieldOf('End date cannot be earlier than start date')).toBe('endDate');
  expect(fieldOf('Duties must be at most 2000 characters')).toBe('duties');
  expect(fieldOf('Achievements must be at most 2000 characters')).toBe('achievements');
  expect(fieldOf('Request body must be a JSON object')).toBeUndefined();
  // The employment type message holds commas of its own; it stays one message.
  expect(
    careerFieldErrors(
      'Employment type must be one of full-time, contract, intern, freelance, other, Company is required',
    ),
  ).toEqual([
    { field: 'company', message: 'Company is required' },
    {
      field: 'employmentType',
      message: 'Employment type must be one of full-time, contract, intern, freelance, other',
    },
  ]);
});

test('form values become the API input and back', () => {
  expect(toCareerInput({ ...emptyCareerForm, endDate: '' }).endDate).toBeNull();
  expect(toCareerInput({ ...emptyCareerForm, endDate: '2023-12-29' }).endDate).toBe('2023-12-29');
  expect(toCareerForm({ ...past, department: null, endDate: null })).toMatchObject({
    department: '',
    endDate: '',
    achievements: '',
  });
});
