import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import {
  type Application,
  applicationFieldOf,
  emptyApplicationForm,
  toApplicationForm,
  toApplicationInput,
} from './application-data';
import { toast } from './components/ui/sonner';
import { findLive, queryLive } from './test/live';
import { parseRequest, unexpectedRequest } from './test/route';
import { type ErrorBody, validation } from './test/server-errors';

// All companies here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const cloud: Application = {
  id: 1,
  companyName: '구름데이터',
  position: '백엔드 개발',
  postingUrl: 'https://careers.example.com/jobs/12',
  deadline: '2026-11-20',
  status: 'drafting',
  memo: null,
};

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with a 400 and that message, as the server would.
 */
function fakeApi(rows: Application[]) {
  const store = [...rows];
  const calls: Call[] = [];
  let refuse: ErrorBody | undefined;
  let deleteFails: { status: number; error: string } | undefined;
  let nextId = 100;
  let questionCount = 0;
  let questionsFail = false;
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
        (url === '/api/applications' && (method === 'GET' || method === 'POST')) ||
        (id !== null &&
          url === `/api/applications/${id}` &&
          (method === 'PUT' || method === 'DELETE')) ||
        (method === 'GET' && /^\/api\/applications\/\d+\/questions$/.test(url));
      if (!known) return unexpectedRequest(request);
      calls.push({ method, url, body });
      if (refuse && (method === 'POST' || method === 'PUT')) {
        const refused = refuse;
        refuse = undefined;
        return json(refused, 400);
      }
      const index = store.findIndex((row) => row.id === id);
      // The delete dialog counts the application's questions (#51).
      if (url.endsWith('/questions')) {
        if (questionsFail) return json({ error: 'Cannot connect to the database' }, 503);
        return json({
          questions: Array.from({ length: questionCount }, (_, n) => ({ id: n + 1 })),
        });
      }
      if (method === 'GET') return json({ applications: store });
      // The server stores blank text as NULL.
      const saved = (input: Application) =>
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
        ) as Application;
      if (method === 'POST') {
        const application = saved({ ...(body as Application), id: nextId++ });
        store.unshift(application);
        return json({ application }, 201);
      }
      if (index === -1) return json({ error: 'Application not found' }, 404);
      if (method === 'PUT') {
        store[index] = saved({ ...(body as Application), id: id as number });
        return json({ application: store[index] });
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
    setQuestionCount: (count: number) => {
      questionCount = count;
    },
    failQuestions: () => {
      questionsFail = true;
    },
  };
}

function open(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

const field = (name: string) => screen.getByLabelText(name);
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

test('a new application starts as drafting, and blank fields are sent for the server to store as NULL', async () => {
  const api = fakeApi([]);
  open('/applications');
  fireEvent.click(await screen.findByRole('link', { name: 'Add application' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Add application' }),
  ).toBeInTheDocument();
  expect(field('Status')).toHaveValue('drafting');

  type('Company name', '한빛소프트');
  type('Notes', '추천 채용');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(
    await screen.findByRole('heading', { level: 1, name: 'Cover letters' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/applications');
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    companyName: '한빛소프트',
    position: '',
    postingUrl: '',
    deadline: null,
    status: 'drafting',
    memo: '추천 채용',
  });
  const list = await screen.findByRole('list', { name: 'Application list' });
  const item = within(list).getByRole('listitem', { name: '한빛소프트' });
  expect(item).toHaveTextContent('Drafting');
  expect(item).toHaveTextContent('No deadline');
  expect(item).toHaveTextContent('추천 채용');
  expect(await screen.findByText("Added '한빛소프트'")).toBeInTheDocument();
});

test('every field is sent as typed, and the status comes from the list', async () => {
  const api = fakeApi([]);
  open('/applications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add application' });
  expect(
    within(field('Status'))
      .getAllByRole('option')
      .map((option) => option.textContent),
  ).toEqual(['Drafting', 'Submitted', 'Closed']);
  type('Company name', '바다물류');
  type('Position', '프론트엔드');
  type('Job posting link', 'https://careers.example.com/jobs/7');
  type('Deadline', '2026-11-01');
  fireEvent.change(field('Status'), { target: { value: 'submitted' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  const item = await screen.findByRole('listitem', { name: '바다물류' });
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    companyName: '바다물류',
    position: '프론트엔드',
    postingUrl: 'https://careers.example.com/jobs/7',
    deadline: '2026-11-01',
    status: 'submitted',
    memo: '',
  });
  expect(item).toHaveTextContent('Submitted');
  expect(item).toHaveTextContent('Due November 1, 2026');
});

test('the deadline hint says an empty date means no deadline', async () => {
  fakeApi([]);
  open('/applications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add application' });
  expect(field('Deadline')).toHaveAccessibleDescription(
    'Leave it empty if there is no deadline. The list shows "No deadline".',
  );
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/applications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add application' });
  type('Company name', '한빛소프트');
  type('Job posting link', 'careers.example.com');
  api.refuseNext(
    validation(['postingUrl', 'Job posting link must start with http:// or https://']),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(field('Job posting link')).toHaveAttribute('aria-invalid', 'true'));
  expect(field('Job posting link')).toHaveAccessibleDescription(
    'Job posting link must start with http:// or https://',
  );
  await waitFor(() => expect(field('Job posting link')).toHaveFocus());
  expect(field('Company name')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('Company name')).toHaveValue('한빛소프트');
  expect(window.location.pathname).toBe('/applications/new');
});

test('each joined server message is shown under its own field, topmost focused', async () => {
  const api = fakeApi([]);
  open('/applications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add application' });
  // The status message itself contains ", " between the allowed values.
  api.refuseNext(
    validation(
      ['memo', 'Notes must be at most 2000 characters'],
      ['status', 'Application status must be one of drafting, submitted, closed'],
      ['companyName', 'Company name is required'],
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Company name')).toHaveFocus());
  expect(field('Company name')).toHaveAccessibleDescription('Company name is required');
  expect(field('Status')).toHaveAccessibleDescription(
    'Application status must be one of drafting, submitted, closed',
  );
  expect(field('Notes')).toHaveAccessibleDescription('Notes must be at most 2000 characters');
  expect(queryLive('alert')).toBeNull();
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/applications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add application' });
  api.refuseNext('Input contains a character that is not allowed (NUL)');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await findLive('alert')).toHaveTextContent(
    'Input contains a character that is not allowed (NUL)',
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus());
});

test('an application is edited with its saved values filled in', async () => {
  const api = fakeApi([cloud]);
  open('/applications');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit 구름데이터' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Edit application' }),
  ).toBeInTheDocument();
  // The heading shows while the item loads; the fields come with the form.
  await screen.findByRole('button', { name: 'Save' });
  expect(window.location.pathname).toBe('/applications/1/edit');
  expect(field('Company name')).toHaveValue('구름데이터');
  expect(field('Position')).toHaveValue('백엔드 개발');
  expect(field('Job posting link')).toHaveValue('https://careers.example.com/jobs/12');
  expect(field('Deadline')).toHaveValue('2026-11-20');
  expect(field('Status')).toHaveValue('drafting');
  expect(field('Notes')).toHaveValue('');

  fireEvent.change(field('Status'), { target: { value: 'submitted' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Cover letters' }),
  ).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/applications/1');
  expect(put?.body).toMatchObject({ status: 'submitted', deadline: '2026-11-20' });
  const item = await screen.findByRole('listitem', { name: '구름데이터' });
  expect(item).toHaveTextContent('Submitted');
  // Submitted shows the date alone, without the countdown.
  expect(item).toHaveTextContent('Due November 20, 2026');
  expect(item).not.toHaveTextContent('D-15');
});

test('clearing the deadline and the link stores no deadline and no link', async () => {
  const api = fakeApi([cloud]);
  open('/applications/1/edit');
  await screen.findByRole('heading', { level: 1, name: 'Edit application' });
  await screen.findByRole('button', { name: 'Save' });
  type('Deadline', '');
  type('Job posting link', '');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  const item = await screen.findByRole('listitem', { name: '구름데이터' });
  expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({
    deadline: null,
    postingUrl: '',
  });
  expect(item).toHaveTextContent('No deadline');
  expect(within(item).queryByRole('link', { name: /Job posting/ })).not.toBeInTheDocument();
});

test('the delete dialog counts the cover letter questions that go with the application', async () => {
  const api = fakeApi([cloud]);
  api.setQuestionCount(3);
  open('/applications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 구름데이터' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
  // The questions written for it go too (#37), so the dialog counts them when it opens (#51).
  expect(
    await within(dialog).findByText(
      "'구름데이터' and its 3 cover letter questions will be deleted. This cannot be undone.",
    ),
  ).toBeInTheDocument();
  expect(api.calls.some((call) => call.url === '/api/applications/1/questions')).toBe(true);
});

test('the delete dialog says when there are no questions, and falls back when it cannot count', async () => {
  const api = fakeApi([cloud, { ...cloud, id: 2, companyName: '바다물류' }]);
  open('/applications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 구름데이터' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
  expect(
    await within(dialog).findByText(
      "'구름데이터' will be deleted. It has no cover letter questions. This cannot be undone.",
    ),
  ).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  api.failQuestions();
  fireEvent.click(screen.getByRole('button', { name: 'Delete 바다물류' }));
  const second = await screen.findByRole('dialog', { name: 'Delete this application?' });
  await waitFor(() =>
    expect(api.calls.filter((call) => call.url.endsWith('/questions'))).toHaveLength(2),
  );
  expect(second).toHaveTextContent(
    "'바다물류' and its cover letter questions will be deleted. This cannot be undone.",
  );
});

test('cancelling the delete dialog keeps the application', async () => {
  const api = fakeApi([cloud]);
  open('/applications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 구름데이터' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: '구름데이터' })).toBeInTheDocument();
});

test('confirming the delete removes the application and moves focus to the page title', async () => {
  const api = fakeApi([cloud]);
  open('/applications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 구름데이터' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByRole('heading', { name: 'No applications added yet' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/applications/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("Deleted '구름데이터'")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: 'Cover letters' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([cloud]);
  api.failDeletes(503, 'Cannot connect to the database');
  open('/applications');
  fireEvent.click(await screen.findByRole('button', { name: 'Delete 구름데이터' }));
  const dialog = await screen.findByRole('dialog', { name: 'Delete this application?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
  expect(
    await screen.findByText('Could not delete the application. Cannot connect to the database'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Delete this application?' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { hidden: true, name: '구름데이터' })).toBeInTheDocument();
});

test('a half-typed deadline is sent as text the server refuses, not as no deadline', async () => {
  const api = fakeApi([]);
  open('/applications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add application' });
  type('Company name', '한빛소프트');
  // A browser reads an unfinished date ("2026-11-__") as '' and flags it as bad input.
  Object.defineProperty(field('Deadline'), 'validity', { value: { badInput: true } });
  api.refuseNext(validation(['deadline', 'Deadline must be a date in YYYY-MM-DD format']));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(field('Deadline')).toHaveFocus());
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    deadline: 'incomplete',
  });
  expect(field('Deadline')).toHaveAccessibleDescription(
    expect.stringContaining('Deadline must be a date in YYYY-MM-DD format'),
  );
  expect(api.store).toHaveLength(0);
});

test('the form can be filled and saved with the keyboard alone', async () => {
  const api = fakeApi([]);
  const user = userEvent.setup();
  open('/applications/new');
  await screen.findByRole('heading', { level: 1, name: 'Add application' });
  // Start from the back link just above the form, as a keyboard user would.
  screen.getByRole('link', { name: 'Application list' }).focus();
  await user.tab();
  expect(field('Company name')).toHaveFocus();
  await user.keyboard('숲게임즈');
  await user.tab();
  expect(field('Position')).toHaveFocus();
  await user.keyboard('게임 서버');
  await user.tab();
  expect(field('Job posting link')).toHaveFocus();
  await user.tab();
  expect(field('Deadline')).toHaveFocus();
  await user.tab();
  expect(field('Status')).toHaveFocus();
  await user.selectOptions(field('Status'), 'Closed');
  await user.tab();
  expect(field('Notes')).toHaveFocus();
  // Enter in a textarea is a new line, so the keyboard user tabs on to the submit button.
  await user.keyboard('불합격');
  await user.tab();
  expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
  await user.keyboard('{Enter}');

  // Checked first, so a broken Enter fails here ("no POST") rather than as a missing heading.
  const posts = () => api.calls.filter((call) => call.method === 'POST');
  await waitFor(() => expect(posts()).toHaveLength(1));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Cover letters' }),
  ).toBeInTheDocument();
  expect(posts()[0].body).toEqual({
    companyName: '숲게임즈',
    position: '게임 서버',
    postingUrl: '',
    deadline: null,
    status: 'closed',
    memo: '불합격',
  });
});

test('a validation path maps to the form field it names', () => {
  for (const field of Object.keys(emptyApplicationForm))
    expect(applicationFieldOf(field)).toBe(field);
  expect(applicationFieldOf('')).toBeUndefined();
  expect(applicationFieldOf('toString')).toBeUndefined();
  expect(applicationFieldOf('items.0.name')).toBeUndefined();
});

test('form values become the API input and back', () => {
  expect(toApplicationInput({ ...emptyApplicationForm, deadline: '' }).deadline).toBeNull();
  expect(toApplicationInput({ ...emptyApplicationForm, deadline: '2026-11-20' }).deadline).toBe(
    '2026-11-20',
  );
  expect(toApplicationForm({ ...cloud, position: null, postingUrl: null, deadline: null })).toEqual(
    {
      companyName: '구름데이터',
      position: '',
      postingUrl: '',
      deadline: '',
      status: 'drafting',
      memo: '',
    },
  );
});
