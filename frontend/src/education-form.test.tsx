import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import {
  type Education,
  educationFieldOf,
  emptyEducationForm,
  toEducationForm,
  toEducationInput,
} from './education-data';
import { parseRequest, unexpectedRequest } from './test/route';
import { type ErrorBody, validation } from './test/server-errors';

// All schools here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

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
  memo: null,
};

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with a 400 and that message, as the server would.
 */
function fakeApi(rows: Education[]) {
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
      const { method, path, id } = request;
      const url = path;
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (method === 'GET' && path === '/api/health') return json({ today: '2026-11-04' });
      const known =
        (path === '/api/educations' && (method === 'GET' || method === 'POST')) ||
        (id !== null &&
          path === `/api/educations/${id}` &&
          (method === 'PUT' || method === 'DELETE'));
      if (!known) return unexpectedRequest(request);
      calls.push({ method, url, body });
      if (refuse && (method === 'POST' || method === 'PUT')) {
        const refused = refuse;
        refuse = undefined;
        return json(refused, 400);
      }
      const index = store.findIndex((row) => row.id === id);
      if (method === 'GET') return json({ educations: store });
      if (method === 'POST') {
        const education = { ...(body as Education), id: nextId++ };
        store.unshift(education);
        return json({ education }, 201);
      }
      if (index === -1) return json({ error: 'Education not found' }, 404);
      if (method === 'PUT') {
        store[index] = { ...(body as Education), id: id as number };
        return json({ education: store[index] });
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

test('a new education is sent to the API and appears in the list', async () => {
  const api = fakeApi([]);
  open('/educations');
  fireEvent.click(await screen.findByRole('link', { name: 'Add education' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Add education' }),
  ).toBeInTheDocument();

  type('School', '한빛대학교 소프트웨어대학원');
  fireEvent.change(field('Degree'), { target: { value: 'master' } });
  fireEvent.change(field('Status'), { target: { value: 'enrolled' } });
  type('Enrollment date', '2024-03-04');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'Education' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/educations');
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    school: '한빛대학교 소프트웨어대학원',
    major: '',
    degree: 'master',
    status: 'enrolled',
    startDate: '2024-03-04',
    endDate: null,
    gpa: null,
    gpaScale: null,
    memo: '',
  });
  const list = await screen.findByRole('list', { name: 'Education list' });
  expect(
    within(list).getByRole('listitem', { name: '한빛대학교 소프트웨어대학원' }),
  ).toBeInTheDocument();
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  type('School', '한빛대학교');
  type('Enrollment date', '2019-03-02');
  type('Graduation date', '2015-02-20');
  api.refuseNext(
    validation(['endDate', 'Graduation date cannot be earlier than the enrollment date']),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(field('Graduation date')).toHaveAttribute('aria-invalid', 'true'));
  expect(field('Graduation date')).toHaveAccessibleDescription(
    expect.stringContaining('Graduation date cannot be earlier than the enrollment date'),
  );
  await waitFor(() => expect(field('Graduation date')).toHaveFocus());
  expect(field('Enrollment date')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('School')).toHaveValue('한빛대학교');
  expect(window.location.pathname).toBe('/educations/new');
});

test('a half-typed graduation date is sent as text the server refuses, not as no date', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  // A browser reads an unfinished date ("2019-02-__") as '' and flags it as bad input.
  Object.defineProperty(field('Graduation date'), 'validity', { value: { badInput: true } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(api.calls.some((call) => call.method === 'POST')).toBe(true));
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    endDate: 'incomplete',
  });
});

test('choosing Enrolled drops a half-typed graduation date instead of sending it', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  // A disabled date input still reports its unfinished parts as bad input.
  Object.defineProperty(field('Graduation date'), 'validity', { value: { badInput: true } });
  fireEvent.change(field('Status'), { target: { value: 'enrolled' } });
  expect(field('Graduation date')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(api.calls.some((call) => call.method === 'POST')).toBe(true));
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    status: 'enrolled',
    endDate: null,
  });
});

test('the grade fields are described by their shared hint', async () => {
  fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  for (const name of ['GPA', 'Maximum GPA']) {
    expect(field(name)).toHaveAccessibleDescription(
      expect.stringContaining('Enter the GPA and maximum GPA together, or leave both empty'),
    );
  }
});

test('choosing Enrolled clears and locks the graduation date', async () => {
  fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  type('Graduation date', '2019-02-20');
  fireEvent.change(field('Status'), { target: { value: 'enrolled' } });
  expect(field('Graduation date')).toHaveValue('');
  expect(field('Graduation date')).toBeDisabled();
});

test('an education is edited with its saved values filled in', async () => {
  const api = fakeApi([university]);
  open('/educations');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit 한빛대학교' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Edit education' }),
  ).toBeInTheDocument();
  // The heading shows while the item loads; the fields come with the form.
  await screen.findByRole('button', { name: 'Save' });
  expect(window.location.pathname).toBe('/educations/1/edit');
  expect(field('School')).toHaveValue('한빛대학교');
  expect(field('GPA')).toHaveValue('3.75');
  expect(field('Maximum GPA')).toHaveValue('4.5');

  type('Major', '소프트웨어공학');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Education' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/educations/1');
  expect(put?.body).toMatchObject({ major: '소프트웨어공학', gpa: 3.75, gpaScale: 4.5 });
  expect(await screen.findByText(/Bachelor · 소프트웨어공학/)).toBeInTheDocument();
});

test('cancelling the delete dialog keeps the education', async () => {
  const api = fakeApi([university]);
  open('/educations');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛대학교' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this education?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(screen.getByRole('listitem', { name: '한빛대학교' })).toBeInTheDocument();
});

test('confirming the delete removes the education and moves focus to the page title', async () => {
  const api = fakeApi([university]);
  open('/educations');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛대학교' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this education?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByRole('heading', { name: 'No education added yet' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/educations/1');
  expect(api.store).toHaveLength(0);
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: 'Education' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([university]);
  api.failDeletes(503, 'Cannot connect to the database');
  open('/educations');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛대학교' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this education?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByText('Could not delete the education. Cannot connect to the database'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete this education?' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { hidden: true, name: '한빛대학교' })).toBeInTheDocument();
});

test('a row that is already gone (404) counts as deleted', async () => {
  const api = fakeApi([university]);
  api.failDeletes(404, 'Education not found');
  open('/educations');
  await screen.findByRole('listitem', { name: '한빛대학교' });
  // Someone else deleted it after the list loaded.
  api.store.splice(0, 1);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 한빛대학교' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this education?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('listitem', { name: '한빛대학교' })).not.toBeInTheDocument();
});

test('text that is not a number reaches the server as typed', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  type('GPA', '3..5');
  type('Maximum GPA', '4.5');
  api.refuseNext(validation(['gpa', 'GPA must be a number']));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('GPA')).toHaveAccessibleDescription(/GPA must be a number/));
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    gpa: '3..5',
    gpaScale: 4.5,
  });
});

test('a GPA without its maximum shows the error under Maximum GPA', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  type('GPA', '3.5');
  api.refuseNext(validation(['gpaScale', 'Maximum GPA is required when GPA is entered']));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() =>
    expect(field('Maximum GPA')).toHaveAccessibleDescription(
      /Maximum GPA is required when GPA is entered/,
    ),
  );
  expect(field('GPA')).not.toHaveAttribute('aria-invalid');
});

test('choosing Enrolled also clears a message about the graduation date', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  type('Graduation date', '2015-02-20');
  api.refuseNext(
    validation(['endDate', 'Graduation date cannot be earlier than the enrollment date']),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Graduation date')).toHaveAttribute('aria-invalid', 'true'));
  fireEvent.change(field('Status'), { target: { value: 'enrolled' } });
  expect(field('Graduation date')).not.toHaveAttribute('aria-invalid');
  expect(
    screen.queryByText('Graduation date cannot be earlier than the enrollment date'),
  ).not.toBeInTheDocument();
});

test('a validation path maps to the form field it names', () => {
  for (const field of Object.keys(emptyEducationForm)) expect(educationFieldOf(field)).toBe(field);
  expect(educationFieldOf('')).toBeUndefined();
  expect(educationFieldOf('toString')).toBeUndefined();
  expect(educationFieldOf('items.0.name')).toBeUndefined();
});

test('form values become the API input and back', () => {
  expect(toEducationInput({ ...emptyEducationForm, gpa: ' 3.5 ', gpaScale: 'abc' })).toMatchObject({
    endDate: null,
    gpa: 3.5,
    // Not a number: sent as typed so the server explains in English.
    gpaScale: 'abc',
  });
  // Number() would read these, and JSON turns Infinity into null (saved without a GPA).
  for (const text of ['Infinity', '-Infinity', '0x4', '1e1', '3..5']) {
    expect(toEducationInput({ ...emptyEducationForm, gpa: text }).gpa).toBe(text);
  }
  expect(toEducationInput({ ...emptyEducationForm, gpa: '.5', gpaScale: '4.' })).toMatchObject({
    gpa: 0.5,
    gpaScale: 4,
  });
  expect(toEducationForm({ ...university, major: null, gpa: null, gpaScale: null })).toMatchObject({
    major: '',
    gpa: '',
    gpaScale: '',
    endDate: '2019-02-20',
  });
});
