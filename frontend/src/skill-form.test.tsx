import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import {
  emptySkillForm,
  proficiencyLevels,
  type Skill,
  skillFieldErrors,
  toSkillForm,
  toSkillInput,
} from './skill-data';

// All skills here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const go: Skill = { id: 1, name: 'Go', category: 'language', proficiency: 3, memo: null };

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with that status and message, as the server would.
 */
function fakeApi(rows: Skill[]) {
  const store = [...rows];
  const calls: Call[] = [];
  let refuse: { status: number; error: string } | undefined;
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
        const { status, error } = refuse;
        refuse = undefined;
        return json({ error }, status);
      }
      const id = Number(url.split('/')[3]);
      const index = store.findIndex((row) => row.id === id);
      if (method === 'GET') return json({ skills: store });
      const saved = (input: Skill) => ({ ...input, memo: input.memo === '' ? null : input.memo });
      if (method === 'POST') {
        const skill = saved({ ...(body as Skill), id: nextId++ });
        store.unshift(skill);
        return json({ skill }, 201);
      }
      if (index === -1) return json({ error: 'Skill not found' }, 404);
      if (method === 'PUT') {
        store[index] = saved({ ...(body as Skill), id });
        return json({ skill: store[index] });
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
    refuseNext: (status: number, error: string) => {
      refuse = { status, error };
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
const level = (name: RegExp) => screen.getByRole('radio', { name });

test('a new skill is sent with its category and chosen proficiency, and listed', async () => {
  const api = fakeApi([]);
  open('/skills');
  fireEvent.click(await screen.findByRole('link', { name: 'Add skill' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Add skill' })).toBeInTheDocument();

  fireEvent.change(field('Skill name'), { target: { value: 'PostgreSQL' } });
  fireEvent.change(field('Category'), { target: { value: 'database' } });
  fireEvent.click(level(/^4 · Advanced/));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(await screen.findByRole('heading', { level: 1, name: 'Skills' })).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    name: 'PostgreSQL',
    category: 'database',
    proficiency: 4,
    memo: '',
  });
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Database 1 entry' }),
  ).toBeInTheDocument();
  const item = screen.getByRole('listitem', { name: 'PostgreSQL' });
  expect(within(item).getByText('Proficiency 4 of 5, Advanced')).toBeInTheDocument();
  expect(await screen.findByText("Added 'PostgreSQL'")).toBeInTheDocument();
});

test('the five steps each say what they mean, and none is chosen for a new skill', async () => {
  fakeApi([]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: 'Add skill' });
  const group = screen.getByRole('group', { name: 'Proficiency' });
  expect(group).toHaveAccessibleDescription('Choose the step closest to what you can do today.');
  const radios = within(group).getAllByRole('radio');
  expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['1', '2', '3', '4', '5']);
  expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
  // Each step is named by its title and described by its criterion.
  for (const step of proficiencyLevels) {
    expect(
      within(group).getByRole('radio', { name: `${String(step.value)} · ${step.name}` }),
    ).toHaveAccessibleDescription(step.criterion);
  }
});

test('no proficiency chosen: the server message is tied to the steps and focus goes to the first', async () => {
  const api = fakeApi([]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: 'Add skill' });
  fireEvent.change(field('Skill name'), { target: { value: 'Rust' } });
  api.refuseNext(400, 'Proficiency must be a whole number from 1 to 5');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(level(/^1 · /)).toHaveFocus());
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    proficiency: null,
  });
  expect(screen.getByRole('group', { name: 'Proficiency' })).toHaveAccessibleDescription(
    expect.stringContaining('Proficiency must be a whole number from 1 to 5'),
  );
  // The focused radio carries the message too, for readers that announce only the control.
  expect(level(/^1 · /)).toHaveAccessibleDescription(
    'I have followed examples Proficiency must be a whole number from 1 to 5',
  );
  expect(field('Skill name')).toHaveValue('Rust');
});

test('a taken name (409) is shown under the name field, not as a general error', async () => {
  const api = fakeApi([go]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: 'Add skill' });
  fireEvent.change(field('Skill name'), { target: { value: 'go' } });
  fireEvent.click(level(/^2 · /));
  api.refuseNext(409, 'This skill is already registered');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Skill name')).toHaveFocus());
  expect(field('Skill name')).toHaveAttribute('aria-invalid', 'true');
  expect(field('Skill name')).toHaveAccessibleDescription('This skill is already registered');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a 409 that names no field still goes below the form', async () => {
  const api = fakeApi([]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: 'Add skill' });
  // The generic unique-violation answer (backend/src/standard/http.ts).
  api.refuseNext(409, 'This item already exists');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This item already exists');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus());
  expect(field('Skill name')).not.toHaveAttribute('aria-invalid');
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: 'Add skill' });
  api.refuseNext(400, 'Request body must be a JSON object');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Request body must be a JSON object');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus());
});

test('a skill is edited with its saved values filled in', async () => {
  const api = fakeApi([go]);
  open('/skills');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit Go' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Edit skill' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/skills/1/edit');
  expect(field('Skill name')).toHaveValue('Go');
  expect(field('Category')).toHaveValue('language');
  expect(level(/^3 · /)).toBeChecked();

  fireEvent.click(level(/^5 · /));
  fireEvent.change(field('Notes'), { target: { value: '사이드 프로젝트 2개' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Skills' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/skills/1');
  expect(put?.body).toEqual({
    name: 'Go',
    category: 'language',
    proficiency: 5,
    memo: '사이드 프로젝트 2개',
  });
  const item = await screen.findByRole('listitem', { name: 'Go' });
  expect(within(item).getByText('Proficiency 5 of 5, Expert')).toBeInTheDocument();
  expect(item).toHaveTextContent('사이드 프로젝트 2개');
});

test('editing a skill that no longer exists says so', async () => {
  fakeApi([]);
  open('/skills/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('Skill not found');
});

test('cancelling the delete dialog keeps the skill', async () => {
  const api = fakeApi([go]);
  open('/skills');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Go' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this skill?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: 'Go' })).toBeInTheDocument();
});

test('confirming the delete removes the skill and moves focus to the page title', async () => {
  const api = fakeApi([go]);
  open('/skills');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Go' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this skill?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByRole('heading', { name: 'No skills added yet' })).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/skills/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("Deleted 'Go'")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: 'Skills' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([go]);
  api.failDeletes(503, 'Cannot connect to the database');
  open('/skills');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Go' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this skill?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByText('Could not delete the skill. Cannot connect to the database'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete this skill?' })).toBeInTheDocument();
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => skillFieldErrors(message)[0]?.field;
  expect(fieldOf('Skill name is required')).toBe('name');
  expect(fieldOf('Skill name must be at most 50 characters')).toBe('name');
  expect(fieldOf('This skill is already registered')).toBe('name');
  expect(fieldOf('Proficiency must be a whole number from 1 to 5')).toBe('proficiency');
  expect(fieldOf('Notes must be at most 2000 characters')).toBe('memo');
  expect(fieldOf('Request body must be a JSON object')).toBeUndefined();
  // The category message holds commas of its own; it stays one message.
  expect(
    skillFieldErrors(
      'Category must be one of language, framework, database, infrastructure, tool, other',
    ),
  ).toHaveLength(1);
});

test('form values become the API input and back', () => {
  expect(toSkillInput(emptySkillForm).proficiency).toBeNull();
  expect(toSkillInput({ ...emptySkillForm, proficiency: '4' }).proficiency).toBe(4);
  expect(toSkillForm(go)).toEqual({ name: 'Go', category: 'language', proficiency: '3', memo: '' });
});
