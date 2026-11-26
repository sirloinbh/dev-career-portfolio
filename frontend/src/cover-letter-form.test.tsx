import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import type { Application } from './application-data';
import { toast } from './components/ui/sonner';
import {
  type CoverLetterQuestion,
  questionFieldOf,
  toQuestionsInput,
  typedLimit,
} from './cover-letter-data';
import { findLive } from './test/live';
import { parseRequest, unexpectedRequest } from './test/route';
import { type ErrorBody, validation } from './test/server-errors';

// All companies, questions, and answers here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const cloud: Application = {
  id: 1,
  companyName: '구름데이터',
  position: null,
  postingUrl: null,
  deadline: null,
  status: 'drafting',
  memo: null,
};

const saved: CoverLetterQuestion[] = [
  { id: 7, question: '지원 동기', answer: '데이터 플랫폼을 만들고 싶습니다.', charLimit: 500 },
  { id: 3, question: '협업 경험', answer: null, charLimit: null },
];

type Call = { method: string; url: string; body: unknown };

/**
 * An in-memory question API for application 1: GET lists, PUT replaces the list as the server does
 * (new questions get ids). `refuseNext` answers the next PUT with that status and message.
 */
function fakeApi(rows: CoverLetterQuestion[]) {
  let store = [...rows];
  const calls: Call[] = [];
  let refuse: { status: number; body: ErrorBody } | undefined;
  let nextId = 100;
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseRequest(input, init);
      const { method, path: url } = request;
      const body: unknown = init?.body ? JSON.parse(String(init.body)) : undefined;
      if (method === 'GET' && url === '/api/health') return json({ today: '2026-11-05' });
      const known =
        (method === 'GET' && url === '/api/applications') ||
        (/^\/api\/applications\/\d+\/questions$/.test(url) &&
          (method === 'GET' || method === 'PUT'));
      if (!known) return unexpectedRequest(request);
      calls.push({ method, url, body });
      // Only application 1 exists in this fake.
      if (url.endsWith('/questions') && url !== '/api/applications/1/questions') {
        return json({ error: 'Application not found' }, 404);
      }
      if (url === '/api/applications') return json({ applications: [cloud] });
      if (method === 'GET') return json({ questions: store });
      if (refuse) {
        const { status, body: refused } = refuse;
        refuse = undefined;
        return json(refused, status);
      }
      const sent = (
        body as { questions: (Partial<CoverLetterQuestion> & { charLimit: unknown })[] }
      ).questions;
      store = sent.map((item) => ({
        id: item.id ?? nextId++,
        question: item.question ?? '',
        answer: item.answer === '' || item.answer === undefined ? null : item.answer,
        charLimit: typeof item.charLimit === 'number' ? item.charLimit : null,
      }));
      return json({ questions: store });
    }),
  );
  return {
    calls,
    store: () => store,
    puts: () => calls.filter((call) => call.method === 'PUT'),
    refuseNext: (status: number, body: string | ErrorBody) => {
      refuse = { status, body: typeof body === 'string' ? { error: body } : body };
    },
  };
}

function open(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

/** The card of question `n` (from 1) in the form. */
const card = (n: number) => screen.getByRole('listitem', { name: `Question ${String(n)}` });
const fieldIn = (n: number, label: string) => within(card(n)).getByLabelText(label);
const type = (element: HTMLElement, value: string) =>
  fireEvent.change(element, { target: { value } });

async function openForm() {
  open('/applications/1/questions/edit');
  await screen.findByRole('list', { name: 'Questions to save' });
}

test('a malformed application id in the form address shows the invalid-address notice', async () => {
  const api = fakeApi(saved);
  open('/applications/abc/questions/edit');
  expect(await findLive('alert')).toHaveTextContent('This address is not valid');
  expect(screen.queryByRole('list', { name: 'Questions to save' })).not.toBeInTheDocument();
  expect(api.calls.some((call) => call.url.includes('/questions'))).toBe(false);
});

test('Edit questions opens the form with the saved questions, and Save keeps the order', async () => {
  const api = fakeApi(saved);
  open('/applications/1');
  fireEvent.click(await screen.findByRole('link', { name: 'Edit questions' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Edit questions: 구름데이터' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/applications/1/questions/edit');
  // The title needs only the application list; the questions may still be loading.
  await screen.findByRole('list', { name: 'Questions to save' });
  expect(fieldIn(1, 'Question')).toHaveValue('지원 동기');
  expect(fieldIn(1, 'Character limit')).toHaveValue('500');
  expect(fieldIn(1, 'Answer')).toHaveValue('데이터 플랫폼을 만들고 싶습니다.');
  expect(fieldIn(2, 'Question')).toHaveValue('협업 경험');
  expect(fieldIn(2, 'Character limit')).toHaveValue('');
  expect(fieldIn(2, 'Answer')).toHaveValue('');

  type(fieldIn(2, 'Answer'), '세 팀과 일정을 맞췄습니다.');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByRole('heading', { level: 1, name: '구름데이터' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/applications/1');
  expect(api.puts()[0].body).toEqual({
    questions: [
      { id: 7, question: '지원 동기', answer: '데이터 플랫폼을 만들고 싶습니다.', charLimit: 500 },
      { id: 3, question: '협업 경험', answer: '세 팀과 일정을 맞췄습니다.', charLimit: null },
    ],
  });
  // The view loads the list again, so what shows is what the server kept.
  expect(await screen.findByText('세 팀과 일정을 맞췄습니다.')).toBeInTheDocument();
  expect(await screen.findByText('Saved the questions')).toBeInTheDocument();
});

test('a new question goes last without an id, and its question field gets focus', async () => {
  const api = fakeApi(saved);
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
  await waitFor(() => expect(fieldIn(3, 'Question')).toHaveFocus());
  type(fieldIn(3, 'Question'), '입사 후 포부');
  type(fieldIn(3, 'Character limit'), '300');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.puts()).toHaveLength(1));
  expect((api.puts()[0].body as { questions: unknown[] }).questions[2]).toEqual({
    question: '입사 후 포부',
    answer: '',
    charLimit: 300,
  });
  expect(api.store().map((row) => row.question)).toEqual([
    '지원 동기',
    '협업 경험',
    '입사 후 포부',
  ]);
});

test('moving a question changes the saved order, and focus stays with the moved question', async () => {
  const api = fakeApi(saved);
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Move question 2 up' }));
  expect(fieldIn(1, 'Question')).toHaveValue('협업 경험');
  expect(fieldIn(2, 'Question')).toHaveValue('지원 동기');
  // It is now first, so Up is off and focus goes to its Down button.
  expect(screen.getByRole('button', { name: 'Move question 1 up' })).toBeDisabled();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Move question 1 down' })).toHaveFocus(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.puts()).toHaveLength(1));
  expect(api.store().map((row) => row.id)).toEqual([3, 7]);
});

test('removing a question asks first; Cancel keeps it and Remove leaves it out of the save', async () => {
  const api = fakeApi(saved);
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }));
  let dialog = await screen.findByRole('dialog', { name: 'Remove this question?' });
  expect(dialog).toHaveTextContent(
    "'지원 동기' and its answer leave the list. Nothing is deleted until you save.",
  );
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(fieldIn(1, 'Question')).toHaveValue('지원 동기');

  fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }));
  dialog = await screen.findByRole('dialog', { name: 'Remove this question?' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(
    within(screen.getByRole('list', { name: 'Questions to save' })).getAllByRole('listitem'),
  ).toHaveLength(1);
  expect(fieldIn(1, 'Question')).toHaveValue('협업 경험');
  // The removed card's button is gone, so focus goes to Add question.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add question' })).toHaveFocus());
  // Nothing was deleted on the server yet.
  expect(api.calls.some((call) => call.method !== 'GET')).toBe(false);

  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.puts()).toHaveLength(1));
  expect(api.store().map((row) => row.id)).toEqual([3]);
});

test('the answer count follows the typing, and an answer over the limit is still saved', async () => {
  const api = fakeApi(saved);
  await openForm();
  const answer = fieldIn(1, 'Answer');
  expect(answer).toHaveAccessibleDescription('18 characters (15 without spaces) / 500');
  type(fieldIn(1, 'Character limit'), '10');
  expect(answer).toHaveAccessibleDescription(
    '18 characters (15 without spaces) / 10 · 8 over the limit. It can still be saved.',
  );
  type(answer, '가 나 다');
  expect(answer).toHaveAccessibleDescription('5 characters (3 without spaces) / 10');
  // No limit, or one the server would refuse, counts without a limit.
  type(fieldIn(1, 'Character limit'), '');
  expect(answer).toHaveAccessibleDescription('5 characters (3 without spaces)');
  type(fieldIn(1, 'Character limit'), '0');
  expect(answer).toHaveAccessibleDescription('5 characters (3 without spaces)');

  // #37: over the limit does not block saving.
  type(fieldIn(1, 'Character limit'), '3');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.puts()).toHaveLength(1));
  expect(api.store()[0]).toMatchObject({ answer: '가 나 다', charLimit: 3 });
});

test('the live announcement names the questions over the limit, and changes only when that set does', async () => {
  fakeApi(saved);
  await openForm();
  const announcement = () =>
    [...document.querySelectorAll('[aria-live="polite"]')].map((e) => e.textContent).join('');
  expect(announcement()).not.toContain('Over the character limit');
  type(fieldIn(2, 'Character limit'), '3');
  type(fieldIn(2, 'Answer'), '가나다라');
  expect(announcement()).toContain('Over the character limit: question 2. It can still be saved.');
  type(fieldIn(2, 'Answer'), '가나다라마');
  expect(announcement()).toContain('Over the character limit: question 2. It can still be saved.');
  type(fieldIn(2, 'Answer'), '가나');
  expect(announcement()).not.toContain('Over the character limit');
});

test('the fields are locked while the list is being saved', async () => {
  const api = fakeApi(saved);
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  // Anything typed now would not be in the request, so the inputs wait.
  expect(fieldIn(1, 'Answer')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add question' })).toBeDisabled();
  await waitFor(() => expect(api.puts()).toHaveLength(1));
  expect(await screen.findByRole('heading', { level: 1, name: '구름데이터' })).toBeInTheDocument();
});

test('the remove dialog quotes only the start of a long question', async () => {
  fakeApi([{ id: 1, question: '가'.repeat(80), answer: null, charLimit: null }]);
  await openForm();
  fireEvent.click(screen.getByRole('button', { name: 'Remove question 1' }));
  const dialog = await screen.findByRole('dialog', { name: 'Remove this question?' });
  expect(dialog).toHaveTextContent(`'${'가'.repeat(60)}…' and its answer leave the list.`);
});

test('a server message is shown under the field of the question it names', async () => {
  const api = fakeApi(saved);
  await openForm();
  type(fieldIn(2, 'Question'), '');
  type(fieldIn(1, 'Character limit'), '만');
  api.refuseNext(
    400,
    validation(
      [
        'questions.0.charLimit',
        'Question 1: Character limit must be a whole number from 1 to 5000',
      ],
      ['questions.1.question', 'Question 2: Question is required'],
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(fieldIn(1, 'Character limit')).toHaveFocus());
  expect(fieldIn(1, 'Character limit')).toHaveAccessibleDescription(
    expect.stringContaining('Question 1: Character limit must be a whole number from 1 to 5000'),
  );
  expect(fieldIn(2, 'Question')).toHaveAccessibleDescription('Question 2: Question is required');
  expect(fieldIn(1, 'Question')).not.toHaveAttribute('aria-invalid');
  // The text that is not a number went as it is, so the server could explain.
  expect(
    (api.puts()[0].body as { questions: { charLimit: unknown }[] }).questions[0].charLimit,
  ).toBe('만');
});

test('editing a question field removes its server message and keeps the other question’s', async () => {
  const api = fakeApi(saved);
  await openForm();
  type(fieldIn(2, 'Question'), '');
  type(fieldIn(1, 'Character limit'), '만');
  api.refuseNext(
    400,
    validation(
      [
        'questions.0.charLimit',
        'Question 1: Character limit must be a whole number from 1 to 5000',
      ],
      ['questions.1.question', 'Question 2: Question is required'],
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(fieldIn(1, 'Character limit')).toHaveFocus());
  type(fieldIn(1, 'Character limit'), '500');
  expect(fieldIn(1, 'Character limit')).not.toHaveAttribute('aria-invalid');
  expect(fieldIn(2, 'Question')).toHaveAttribute('aria-invalid', 'true');
  expect(fieldIn(2, 'Question')).toHaveAccessibleDescription('Question 2: Question is required');
});

test('a failed save keeps everything typed on screen and says why', async () => {
  const api = fakeApi(saved);
  await openForm();
  type(fieldIn(1, 'Answer'), '고친 답변');
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
  type(fieldIn(3, 'Question'), '새 문항');
  api.refuseNext(503, 'Cannot connect to the database');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await findLive('alert')).toHaveTextContent('Cannot connect to the database');
  expect(window.location.pathname).toBe('/applications/1/questions/edit');
  expect(fieldIn(1, 'Answer')).toHaveValue('고친 답변');
  expect(fieldIn(3, 'Question')).toHaveValue('새 문항');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus());
  // Saving again sends the same list.
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.puts()).toHaveLength(2));
  expect(api.store().map((row) => row.question)).toEqual(['지원 동기', '협업 경험', '새 문항']);
});

test('a list another tab changed (409) is reported below the form, not under a field', async () => {
  const api = fakeApi(saved);
  await openForm();
  api.refuseNext(409, 'Some questions do not belong to this application. Please reload the list');
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await findLive('alert')).toHaveTextContent(
    'Some questions do not belong to this application. Please reload the list',
  );
  expect(fieldIn(1, 'Question')).not.toHaveAttribute('aria-invalid');
});

test('the form page announces loading and clears it once the questions are in', async () => {
  fakeApi(saved);
  open('/applications/1/questions/edit');
  expect(screen.getByText('Loading questions')).toHaveAttribute('role', 'status');
  await screen.findByRole('list', { name: 'Questions to save' });
  expect(screen.queryByText('Loading questions')).toBeNull();
});

test('adding, moving or removing a question counts as a change', async () => {
  fakeApi(saved);
  await openForm();
  const asksFirst = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };
  expect(asksFirst()).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Move question 2 up' }));
  expect(asksFirst()).toBe(true);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
});

test('Add question stops at ten questions', async () => {
  fakeApi(
    Array.from({ length: 9 }, (_, n) => ({
      id: n + 1,
      question: `문항 ${String(n + 1)}`,
      answer: null,
      charLimit: null,
    })),
  );
  await openForm();
  const addButton = screen.getByRole('button', { name: 'Add question' });
  expect(addButton).toHaveAccessibleDescription(
    '9 of 10 questions. The order here is the saved order.',
  );
  fireEvent.click(addButton);
  expect(addButton).toBeDisabled();
  expect(addButton).toHaveAccessibleDescription(
    '10 of 10 questions. The order here is the saved order.',
  );
});

test('an application without questions can start one, or save none', async () => {
  const api = fakeApi([]);
  open('/applications/1/questions/edit');
  expect(await screen.findByText(/No questions. Choose Add question/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.puts()).toHaveLength(1));
  expect(api.puts()[0].body).toEqual({ questions: [] });
});

test('the form for an application that no longer exists says so', async () => {
  fakeApi([]);
  open('/applications/9/questions/edit');
  expect(await findLive('alert')).toHaveTextContent('Application not found');
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

test('form rules: the list as the API takes it, typed limits, and message fields', () => {
  expect(
    toQuestionsInput([
      { key: 0, id: 7, question: '지원 동기', answer: '', charLimit: ' 500 ' },
      { key: 4, question: '새 문항', answer: '답', charLimit: '' },
      { key: 2, question: '틀린 제한', answer: '', charLimit: '1e3' },
    ]),
  ).toEqual({
    questions: [
      { id: 7, question: '지원 동기', answer: '', charLimit: 500 },
      { question: '새 문항', answer: '답', charLimit: null },
      { question: '틀린 제한', answer: '', charLimit: '1e3' },
    ],
  });
  expect(typedLimit('1500')).toBe(1500);
  expect(typedLimit('')).toBeNull();
  expect(typedLimit('0')).toBeNull();
  expect(typedLimit('5001')).toBeNull();
  expect(typedLimit('1.5')).toBeNull();

  // Positions in the message are positions in the list that was sent, whatever their keys.
  const fieldOf = questionFieldOf([4, 0, 9, 1, 2, 3, 5, 6, 7, 8]);
  expect(fieldOf('questions.0.question')).toBe('4:question');
  expect(fieldOf('questions.1.answer')).toBe('0:answer');
  expect(fieldOf('questions.9.charLimit')).toBe('8:charLimit');
  expect(fieldOf('questions.0.id')).toBeUndefined();
  expect(fieldOf('questions.12.answer')).toBeUndefined();
  expect(fieldOf('questions')).toBeUndefined();
});
