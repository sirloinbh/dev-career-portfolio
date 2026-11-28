import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import type { Application } from './application-data';
import {
  answerLength,
  answerLengthText,
  answerLengthWithoutSpaces,
  type CoverLetterQuestion,
} from './cover-letter-data';
import { findLive, getLive } from './test/live';

// All companies, questions, and answers here are made up for the test.

const cloud: Application = {
  id: 1,
  companyName: '구름데이터',
  position: '백엔드 개발',
  postingUrl: null,
  deadline: '2026-11-08',
  status: 'drafting',
  memo: null,
};
const sea: Application = { ...cloud, id: 2, companyName: '바다물류', position: null };

const question = (
  id: number,
  text: string,
  answer: string | null,
  charLimit: number | null,
): CoverLetterQuestion => ({ id, question: text, answer, charLimit });

const questionsOf: Record<string, CoverLetterQuestion[]> = {
  // Ids out of order on purpose: the screen keeps the API order, which is the saved order.
  '1': [
    question(7, '지원 동기를\n적어 주세요', '데이터 플랫폼을 만들고 싶습니다.', 500),
    question(3, '협업 경험', null, null),
    question(5, '입사 후 포부', '가'.repeat(12), 10),
  ],
  '2': [question(9, '바다물류 문항', '물류 답변', null)],
};

// The stage changes every fake application has (#229).
const stages = [
  { id: 1, fromStatus: null, status: 'drafting', date: '2026-10-20' },
  { id: 2, fromStatus: 'drafting', status: 'submitted', date: '2026-11-01' },
  { id: 3, fromStatus: 'submitted', status: 'first_interview', date: '2026-11-12' },
];

type Reply = { status: number; body: object } | 'offline';

/** Lets the next answer for a held application's questions out (see `serve`). */
let release: (() => void) | undefined;

/**
 * Answers the list, each application's questions (or `override`), and /api/health. The questions of
 * the `hold` application wait until `release()` is called.
 */
function serve(override?: Reply, hold?: string) {
  const urls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const json = (body: object, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(body), { status }));
      if (url === '/api/health') return json({ today: '2026-11-05' });
      urls.push(url);
      if (url === '/api/applications') return json({ applications: [cloud, sea] });
      if (/^\/api\/applications\/\d+\/status-history$/.test(url)) return json({ history: stages });
      if (/^\/api\/applications\/\d+\/interviews$/.test(url)) return json({ interviews: [] });
      const id = /^\/api\/applications\/([^/]+)\/questions$/.exec(url)?.[1];
      if (id === undefined) return json({ error: 'API not found' }, 404);
      if (override === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
      if (override) return json(override.body, override.status);
      const questions = questionsOf[id];
      const reply = () =>
        questions ? json({ questions }) : json({ error: 'Application not found' }, 404);
      if (id === hold) {
        return new Promise<Response>((resolve) => {
          release = () => void reply().then(resolve);
        });
      }
      return reply();
    }),
  );
  return urls;
}

function open(path: string) {
  window.history.replaceState(null, '', path);
  render(<App />);
}

const titles = () =>
  within(screen.getByRole('list', { name: 'Question list' }))
    .getAllByRole('heading', { level: 2 })
    .map((heading) => heading.textContent);

test('the Questions link on a list row opens that application’s questions in saved order', async () => {
  serve();
  open('/applications');
  fireEvent.click(
    await screen.findByRole('link', { name: 'Cover letter questions for 구름데이터' }),
  );
  expect(await screen.findByRole('heading', { level: 1, name: '구름데이터' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/applications/1');
  await screen.findByRole('list', { name: 'Question list' });
  expect(titles()).toEqual(['지원 동기를\n적어 주세요', '협업 경험', '입사 후 포부']);
  expect(getLive('status')).toHaveTextContent('3 questions');

  const [first, second, third] = within(
    screen.getByRole('list', { name: 'Question list' }),
  ).getAllByRole('listitem');
  expect(first).toHaveAccessibleName('지원 동기를\n적어 주세요');
  expect(first).toHaveTextContent('Question 1');
  expect(first).toHaveTextContent('데이터 플랫폼을 만들고 싶습니다.');
  expect(first).toHaveTextContent('18 characters (15 without spaces) / 500');
  expect(second).toHaveTextContent('Question 2');
  expect(second).toHaveTextContent('No answer yet');
  expect(second).toHaveTextContent('0 characters (0 without spaces)');
  // #37 stores an answer over the limit; the screen points it out.
  expect(third).toHaveTextContent('12 characters (12 without spaces) / 10 · 2 over the limit');
});

test('the page shows the application it belongs to', async () => {
  serve();
  open('/applications/1');
  await screen.findByRole('heading', { level: 1, name: '구름데이터' });
  expect(screen.getAllByText('Drafting').length).toBeGreaterThan(0);
  expect(screen.getByText('백엔드 개발')).toBeInTheDocument();
  expect(screen.getByText(/^Due Nov 8, 2026/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Application list' })).toHaveAttribute(
    'href',
    '/applications',
  );
});

test('another application shows only its own questions', async () => {
  const urls = serve();
  open('/applications/1');
  await screen.findByRole('list', { name: 'Question list' });
  fireEvent.click(screen.getByRole('link', { name: 'Application list' }));
  fireEvent.click(await screen.findByRole('link', { name: 'Cover letter questions for 바다물류' }));
  expect(await screen.findByRole('heading', { level: 1, name: '바다물류' })).toBeInTheDocument();
  expect(
    await screen.findByRole('heading', { level: 2, name: '바다물류 문항' }),
  ).toBeInTheDocument();
  expect(titles()).toEqual(['바다물류 문항']);
  expect(screen.queryByText('협업 경험')).not.toBeInTheDocument();
  expect(urls.filter((url) => url.endsWith('/questions'))).toEqual([
    '/api/applications/1/questions',
    '/api/applications/2/questions',
  ]);
});

test('a malformed application id shows the invalid-address notice and no Edit questions link', async () => {
  const urls = serve();
  open('/applications/abc');
  expect(await findLive('alert')).toHaveTextContent('This address is not valid');
  expect(screen.queryByRole('link', { name: /Edit questions/ })).not.toBeInTheDocument();
  expect(urls.some((url) => url.includes('/questions'))).toBe(false);
});

test('changing the address on the open page never leaves the previous questions on screen', async () => {
  serve(undefined, '2');
  open('/applications/1');
  await screen.findByRole('heading', { level: 2, name: '협업 경험' });
  // The same page stays mounted; only the id in the address changes (back and forward do this).
  act(() => {
    window.history.pushState(null, '', '/applications/2');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  // While application 2's questions are still on their way, application 1's are already gone.
  expect(await screen.findByText('Loading questions')).toBeInTheDocument();
  expect(screen.queryByText('협업 경험')).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Question list' })).not.toBeInTheDocument();
  act(() => release?.());
  expect(
    await screen.findByRole('heading', { level: 2, name: '바다물류 문항' }),
  ).toBeInTheDocument();
  expect(titles()).toEqual(['바다물류 문항']);
});

test('an application without questions says so', async () => {
  serve({ status: 200, body: { questions: [] } });
  open('/applications/1');
  expect(await screen.findByRole('heading', { name: 'No questions yet' })).toBeInTheDocument();
  expect(getLive('status')).toHaveTextContent('0 questions');
  expect(screen.queryByRole('list', { name: 'Question list' })).not.toBeInTheDocument();
});

test('an application that no longer exists says so', async () => {
  serve();
  open('/applications/9');
  expect(await findLive('alert')).toHaveTextContent(
    'Application not found. It may already be deleted.',
  );
  // Nothing to name it by, so the title stays general.
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cover letter questions');
});

test('a failed request shows the reason, not an empty list', async () => {
  serve({ status: 503, body: { error: 'Cannot connect to the database' } });
  open('/applications/1');
  expect(await findLive('alert')).toHaveTextContent(
    'Could not load the questions. Cannot connect to the database',
  );
  expect(screen.queryByRole('heading', { name: 'No questions yet' })).not.toBeInTheDocument();
});

test('an unreachable server is reported, not shown as an empty list', async () => {
  serve('offline');
  open('/applications/1');
  expect(await findLive('alert')).toHaveTextContent('Could not load the questions.');
  expect(screen.queryByRole('heading', { name: 'No questions yet' })).not.toBeInTheDocument();
});

test('the loading state is announced and marks the page busy', () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => undefined)),
  );
  open('/applications/1');
  expect(getLive('status')).toHaveTextContent('Loading questions');
  expect(screen.getByRole('region', { name: 'Cover letter questions' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
});

test('display rules: answer length counts every character, spaces and line breaks included', () => {
  expect(answerLength(null)).toBe(0);
  expect(answerLength('가 나\n다')).toBe(5);
  // One emoji is one character, not two UTF-16 units.
  expect(answerLength('좋아요👍')).toBe(4);
  expect(answerLengthText({ answer: null, charLimit: null })).toBe(
    '0 characters (0 without spaces)',
  );
  expect(answerLengthText({ answer: '가'.repeat(1204), charLimit: null })).toBe(
    '1,204 characters (1,204 without spaces)',
  );
  expect(answerLengthText({ answer: '가'.repeat(1500), charLimit: 1500 })).toBe(
    '1,500 characters (1,500 without spaces) / 1,500',
  );
  // The warning follows the count with spaces, not the count without.
  expect(
    answerLengthText({ answer: `${'가'.repeat(1000)}${' '.repeat(620)}`, charLimit: 1500 }),
  ).toBe('1,620 characters (1,000 without spaces) / 1,500 · 120 over the limit');
});

test('display rules: the count without spaces leaves out spaces, tabs, line breaks and keeps emoji whole', () => {
  expect(answerLengthWithoutSpaces(null)).toBe(0);
  expect(answerLengthWithoutSpaces('')).toBe(0);
  expect(answerLengthWithoutSpaces('가 나\n다')).toBe(3);
  expect(answerLengthWithoutSpaces('a\tb\r\nc\u3000d')).toBe(4);
  expect(answerLengthWithoutSpaces(' \n\t ')).toBe(0);
  expect(answerLengthWithoutSpaces('좋아요 👍 👍')).toBe(5);
});

test('the page lists the stage changes of the application with their dates', async () => {
  serve();
  open('/applications/1');
  const list = await screen.findByRole('list', { name: 'Status changes' });
  const rows = within(list).getAllByRole('listitem');
  expect(rows).toHaveLength(3);
  expect(rows[0]).toHaveTextContent('Oct 20, 2026');
  expect(rows[0]).toHaveTextContent('Started as');
  expect(rows[0]).toHaveTextContent('Drafting');
  expect(rows[2]).toHaveTextContent('Nov 12, 2026');
  expect(rows[2]).toHaveTextContent('Submitted');
  expect(rows[2]).toHaveTextContent('First interview');
});
