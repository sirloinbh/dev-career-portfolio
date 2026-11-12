import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import {
  type Certification,
  certificationFieldErrors,
  emptyCertificationForm,
  toCertificationForm,
  toCertificationInput,
} from './certification-data';
import { toast } from './components/ui/sonner';

// All certifications here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const toeic: Certification = {
  id: 1,
  name: 'TOEIC',
  issuer: 'ETS',
  acquiredDate: '2025-03-09',
  expiryDate: '2027-03-08',
  score: '905점',
  memo: null,
};

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with a 400 and that message, as the server would.
 */
function fakeApi(rows: Certification[]) {
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
      if (method === 'GET') return json({ certifications: store });
      // The server stores blank text as NULL.
      const saved = (input: Certification) =>
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
        ) as Certification;
      if (method === 'POST') {
        const certification = saved({ ...(body as Certification), id: nextId++ });
        store.unshift(certification);
        return json({ certification }, 201);
      }
      if (index === -1) return json({ error: 'Certification not found' }, 404);
      if (method === 'PUT') {
        store[index] = saved({ ...(body as Certification), id });
        return json({ certification: store[index] });
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

test('a new certification with no expiry date is sent as null and listed as No expiry', async () => {
  const api = fakeApi([]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('link', { name: 'Add certification' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Add certification' }),
  ).toBeInTheDocument();

  type('Certification name', '정보처리기사');
  type('Issuer', '한국산업인력공단');
  type('Date earned', '2021-08-20');
  type('Notes', '실기 2회 응시');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Certifications' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/certifications');
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    name: '정보처리기사',
    issuer: '한국산업인력공단',
    acquiredDate: '2021-08-20',
    expiryDate: null,
    score: '',
    memo: '실기 2회 응시',
  });
  const list = await screen.findByRole('list', { name: 'Certification list' });
  const item = within(list).getByRole('listitem', { name: '정보처리기사' });
  expect(item).toHaveTextContent('Earned August 20, 2021 · No expiry');
  expect(item).toHaveTextContent('실기 2회 응시');
  expect(await screen.findByText("Added '정보처리기사'")).toBeInTheDocument();
});

test('the expiry date hint says an empty date means it never expires', async () => {
  fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add certification' });
  expect(field('Expiry date')).toHaveAccessibleDescription(
    'Leave it empty if the certification does not expire. The list shows "No expiry".',
  );
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add certification' });
  type('Certification name', 'TOEIC');
  type('Issuer', 'ETS');
  type('Date earned', '2025-03-09');
  type('Expiry date', '2024-03-08');
  api.refuseNext('Expiry date cannot be earlier than the date earned');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(field('Expiry date')).toHaveAttribute('aria-invalid', 'true'));
  expect(field('Expiry date')).toHaveAccessibleDescription(
    expect.stringContaining('Expiry date cannot be earlier than the date earned'),
  );
  await waitFor(() => expect(field('Expiry date')).toHaveFocus());
  expect(field('Date earned')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('Certification name')).toHaveValue('TOEIC');
  expect(window.location.pathname).toBe('/certifications/new');
});

test('each joined server message is shown under its own field, topmost focused', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add certification' });
  api.refuseNext(
    'Score or grade must be at most 50 characters, Issuer is required, Certification name is required',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Certification name')).toHaveFocus());
  expect(field('Certification name')).toHaveAccessibleDescription('Certification name is required');
  expect(field('Issuer')).toHaveAccessibleDescription('Issuer is required');
  expect(field('Score or grade')).toHaveAccessibleDescription(
    'Score or grade must be at most 50 characters',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add certification' });
  api.refuseNext('Input contains a character that is not allowed (NUL)');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Input contains a character that is not allowed (NUL)',
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus());
});

test('a certification is edited with its saved values filled in', async () => {
  const api = fakeApi([toeic]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit TOEIC' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Edit certification' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/certifications/1/edit');
  expect(field('Certification name')).toHaveValue('TOEIC');
  expect(field('Issuer')).toHaveValue('ETS');
  expect(field('Date earned')).toHaveValue('2025-03-09');
  expect(field('Expiry date')).toHaveValue('2027-03-08');
  expect(field('Score or grade')).toHaveValue('905점');
  expect(field('Notes')).toHaveValue('');

  type('Score or grade', '950점');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Certifications' }),
  ).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/certifications/1');
  expect(put?.body).toMatchObject({ score: '950점', expiryDate: '2027-03-08' });
  expect(await screen.findByText('ETS · 950점')).toBeInTheDocument();
});

test('clearing the expiry date makes the certification No expiry', async () => {
  const api = fakeApi([toeic]);
  open('/certifications/1/edit');
  await screen.findByRole('heading', { level: 1, name: 'Edit certification' });
  type('Expiry date', '');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const item = await screen.findByRole('listitem', { name: 'TOEIC' });
  expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({
    expiryDate: null,
  });
  expect(item).toHaveTextContent('Earned March 9, 2025 · No expiry');
});

test('editing a certification that no longer exists says so', async () => {
  fakeApi([]);
  open('/certifications/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('Certification not found');
});

test('cancelling the delete dialog keeps the certification', async () => {
  const api = fakeApi([toeic]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete TOEIC' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this certification?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: 'TOEIC' })).toBeInTheDocument();
});

test('confirming the delete removes the certification and moves focus to the page title', async () => {
  const api = fakeApi([toeic]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete TOEIC' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this certification?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByRole('heading', { name: 'No certifications added yet' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/certifications/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("Deleted 'TOEIC'")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: 'Certifications' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([toeic]);
  api.failDeletes(503, 'Cannot connect to the database');
  open('/certifications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete TOEIC' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this certification?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByText('Could not delete the certification. Cannot connect to the database'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete this certification?' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { hidden: true, name: 'TOEIC' })).toBeInTheDocument();
});

test('a half-typed expiry date is sent as text the server refuses, not as never expiring', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add certification' });
  type('Certification name', 'TOEIC');
  type('Issuer', 'ETS');
  type('Date earned', '2025-03-09');
  // A browser reads an unfinished date ("2027-03-__") as '' and flags it as bad input.
  Object.defineProperty(field('Expiry date'), 'validity', { value: { badInput: true } });
  api.refuseNext('Expiry date must be a date in YYYY-MM-DD format');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Expiry date')).toHaveFocus());
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    expiryDate: 'incomplete',
  });
  expect(field('Expiry date')).toHaveAccessibleDescription(
    expect.stringContaining('Expiry date must be a date in YYYY-MM-DD format'),
  );
  expect(api.store).toHaveLength(0);
});

test('a row that is already gone (404) counts as deleted', async () => {
  const api = fakeApi([toeic]);
  api.failDeletes(404, 'Certification not found');
  open('/certifications');
  await screen.findByRole('listitem', { name: 'TOEIC' });
  // Someone else deleted it after the list loaded.
  api.store.splice(0, 1);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete TOEIC' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this certification?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('listitem', { name: 'TOEIC' })).not.toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { name: 'No certifications added yet' }),
  ).toBeInTheDocument();
  expect(await screen.findByText("Deleted 'TOEIC'")).toBeInTheDocument();
  expect(screen.queryByText(/Could not delete/)).not.toBeInTheDocument();
});

test('the form can be filled and saved with Tab and Enter alone', async () => {
  const api = fakeApi([]);
  const user = userEvent.setup();
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add certification' });
  // Start from the back link just above the form, as a keyboard user would.
  screen.getByRole('link', { name: 'Certification list' }).focus();
  await user.tab();
  expect(field('Certification name')).toHaveFocus();
  await user.keyboard('SQLD');
  await user.tab();
  expect(field('Issuer')).toHaveFocus();
  await user.keyboard('한국데이터산업진흥원');
  await user.tab();
  expect(field('Date earned')).toHaveFocus();
  await user.keyboard('2023-06-23');
  await user.tab();
  expect(field('Expiry date')).toHaveFocus();
  await user.tab();
  expect(field('Score or grade')).toHaveFocus();
  await user.keyboard('합격{Enter}');

  // Checked first, so a broken Enter fails here ("no POST") rather than as a missing heading.
  const posts = () => api.calls.filter((call) => call.method === 'POST');
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Certifications' }),
  ).toBeInTheDocument();
  expect(posts()[0].body).toEqual({
    name: 'SQLD',
    issuer: '한국데이터산업진흥원',
    acquiredDate: '2023-06-23',
    expiryDate: null,
    score: '합격',
    memo: '',
  });
});

// What the Tab and Enter test relies on, checked directly so a failure says which part broke.
test('the form is built for keyboard use: native controls in order and a submit button', async () => {
  fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add certification' });
  const inputs = [
    'Certification name',
    'Issuer',
    'Date earned',
    'Expiry date',
    'Score or grade',
    'Notes',
  ].map(field);
  for (const input of inputs) expect(['INPUT', 'TEXTAREA']).toContain(input.tagName);
  for (let index = 1; index < inputs.length; index++) {
    expect(
      inputs[index - 1].compareDocumentPosition(inputs[index]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  }
  const form = inputs[0].closest('form');
  const submit = screen.getByRole('button', { name: 'Add' });
  expect(submit).toHaveAttribute('type', 'submit');
  expect(form).toContainElement(submit);
  for (const input of inputs) expect(form).toContainElement(input);
  // The submit button comes after the last field, so Tab reaches it last.
  expect(
    inputs[inputs.length - 1].compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => certificationFieldErrors(message)[0]?.field;
  expect(fieldOf('Certification name is required')).toBe('name');
  expect(fieldOf('Issuer must be at most 100 characters')).toBe('issuer');
  expect(fieldOf('Date earned must be a date in YYYY-MM-DD format')).toBe('acquiredDate');
  expect(fieldOf('Expiry date cannot be earlier than the date earned')).toBe('expiryDate');
  expect(fieldOf('Score or grade must be text')).toBe('score');
  expect(fieldOf('Notes must be at most 2000 characters')).toBe('memo');
  expect(fieldOf('Request body must be a JSON object')).toBeUndefined();
});

test('form values become the API input and back', () => {
  expect(toCertificationInput({ ...emptyCertificationForm, expiryDate: '' }).expiryDate).toBeNull();
  expect(
    toCertificationInput({ ...emptyCertificationForm, expiryDate: '2027-03-08' }).expiryDate,
  ).toBe('2027-03-08');
  expect(toCertificationForm({ ...toeic, expiryDate: null, score: null })).toEqual({
    name: 'TOEIC',
    issuer: 'ETS',
    acquiredDate: '2025-03-09',
    expiryDate: '',
    score: '',
    memo: '',
  });
});
