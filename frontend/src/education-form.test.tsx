import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import {
  type Education,
  emptyEducationForm,
  fieldErrors,
  toEducationForm,
  toEducationInput,
} from './education-data';

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
      if (url === '/api/health') return json({ today: '2026-11-04' });
      calls.push({ method, url, body });
      if (refuse && (method === 'POST' || method === 'PUT')) {
        const error = refuse;
        refuse = undefined;
        return json({ error }, 400);
      }
      const id = Number(url.split('/')[3]);
      const index = store.findIndex((row) => row.id === id);
      if (method === 'GET') return json({ educations: store });
      if (method === 'POST') {
        const education = { ...(body as Education), id: nextId++ };
        store.unshift(education);
        return json({ education }, 201);
      }
      if (index === -1) return json({ error: 'Education not found' }, 404);
      if (method === 'PUT') {
        store[index] = { ...(body as Education), id };
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
  api.refuseNext('Graduation date cannot be earlier than the enrollment date');
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

test('a message that names no field is shown below the form', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  api.refuseNext('Input contains a character that is not allowed (NUL)');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Input contains a character that is not allowed (NUL)',
  );
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

test('editing an education that no longer exists says so', async () => {
  fakeApi([]);
  open('/educations/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('Education not found');
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
  api.refuseNext('GPA must be a number');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('GPA')).toHaveAccessibleDescription(/GPA must be a number/));
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    gpa: '3..5',
    gpaScale: 4.5,
  });
});

test('choosing Enrolled also clears a message about the graduation date', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  type('Graduation date', '2015-02-20');
  api.refuseNext('Graduation date cannot be earlier than the enrollment date');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Graduation date')).toHaveAttribute('aria-invalid', 'true'));
  fireEvent.change(field('Status'), { target: { value: 'enrolled' } });
  expect(field('Graduation date')).not.toHaveAttribute('aria-invalid');
  expect(
    screen.queryByText('Graduation date cannot be earlier than the enrollment date'),
  ).not.toBeInTheDocument();
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => fieldErrors(message)[0]?.field;
  expect(fieldOf('School is required')).toBe('school');
  expect(fieldOf('Enrollment date must be a date in YYYY-MM-DD format')).toBe('startDate');
  expect(fieldOf('Graduation date cannot be earlier than the enrollment date')).toBe('endDate');
  expect(fieldOf('Graduation date must be empty while enrolled')).toBe('endDate');
  expect(fieldOf('GPA and maximum GPA must be entered together')).toBe('gpa');
  expect(fieldOf('Maximum GPA must be greater than 0')).toBe('gpaScale');
  expect(fieldOf('Notes must be at most 2000 characters')).toBe('memo');
  expect(fieldOf('Request body must be a JSON object')).toBeUndefined();
});

test('several joined messages are split per field, keeping commas inside one message', () => {
  expect(
    fieldErrors(
      'Enrollment date must be a date in YYYY-MM-DD format, Degree must be one of high school, associate, bachelor, master, doctorate, other, and 2 more',
    ),
  ).toEqual([
    // Screen order: Degree sits above Enrollment date.
    {
      field: 'degree',
      message:
        'Degree must be one of high school, associate, bachelor, master, doctorate, other, and 2 more',
    },
    { field: 'startDate', message: 'Enrollment date must be a date in YYYY-MM-DD format' },
  ]);
});

test('focus goes to the topmost field with a message, not the first one the server named', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  // zod reports per-field issues before cross-field ones, so GPA comes before Graduation date.
  api.refuseNext(
    'GPA must have at most two decimal places, Graduation date cannot be earlier than the enrollment date, GPA cannot be greater than the maximum GPA',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Graduation date')).toHaveFocus());
  expect(field('GPA')).toHaveAccessibleDescription(
    /GPA must have at most two decimal places, GPA cannot be greater than the maximum GPA$/,
  );
});

test('after a message that names no field, focus returns to the submit button', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  api.refuseNext('Input contains a character that is not allowed (NUL)');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await screen.findByRole('alert');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus());
});

test('two messages about one field are kept even with another field between them', () => {
  expect(
    fieldErrors(
      'GPA must have at most two decimal places, Maximum GPA must have at most two decimal places, GPA cannot be greater than the maximum GPA',
    ),
  ).toEqual([
    {
      field: 'gpa',
      message:
        'GPA must have at most two decimal places, GPA cannot be greater than the maximum GPA',
    },
    { field: 'gpaScale', message: 'Maximum GPA must have at most two decimal places' },
  ]);
});

test('each joined server message is shown under its own field', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: 'Add education' });
  api.refuseNext('School is required, Enrollment date must be a date in YYYY-MM-DD format');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('School')).toHaveFocus());
  expect(field('School')).toHaveAccessibleDescription('School is required');
  expect(field('Enrollment date')).toHaveAccessibleDescription(
    'Enrollment date must be a date in YYYY-MM-DD format',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
