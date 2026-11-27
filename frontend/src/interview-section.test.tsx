import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import type { Application } from './application-data';
import type { Interview } from './interview-data';

// Companies and interviews here are made up for the test.

const cloud: Application = {
  id: 1,
  companyName: '구름데이터',
  position: '백엔드 개발',
  postingUrl: null,
  deadline: null,
  status: 'first_interview',
  memo: null,
};

type Body = Record<string, unknown>;

/** A fake API that keeps the interviews of application 1 in date order, like the server. */
function serve(initial: Interview[]) {
  let interviews = [...initial];
  let nextId = 100;
  const calls: { method: string; url: string; body?: Body }[] = [];
  const sorted = () =>
    [...interviews].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? (JSON.parse(String(init.body)) as Body) : undefined;
      calls.push({ method, url, body });
      const json = (data: object, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), { status }));
      if (url === '/api/health') return json({ today: '2026-11-05' });
      if (url === '/api/applications') return json({ applications: [cloud] });
      if (url === '/api/applications/1/status-history') return json({ history: [] });
      if (url === '/api/applications/1/questions') return json({ questions: [] });
      if (url === '/api/applications/1/interviews') {
        if (method === 'POST') {
          if (body?.date === '') {
            return json(
              {
                error: 'Date must be a date in YYYY-MM-DD format',
                fields: [{ path: 'date', message: 'Date must be a date in YYYY-MM-DD format' }],
              },
              400,
            );
          }
          const created = {
            id: nextId++,
            questions: null,
            retrospective: null,
            ...body,
          } as Interview;
          interviews.push(created);
          return json({ interview: created }, 201);
        }
        return json({ interviews: sorted() });
      }
      const one = /^\/api\/applications\/1\/interviews\/(\d+)$/.exec(url);
      if (one) {
        const id = Number(one[1]);
        if (method === 'DELETE') {
          interviews = interviews.filter((item) => item.id !== id);
          return Promise.resolve(new Response(null, { status: 204 }));
        }
        interviews = interviews.map((item) => (item.id === id ? { ...item, ...body } : item));
        return json({ interview: interviews.find((item) => item.id === id) });
      }
      return json({ error: 'API not found' }, 404);
    }),
  );
  return calls;
}

const first: Interview = {
  id: 1,
  round: 1,
  date: '2026-11-02',
  time: '10:00',
  format: 'phone',
  questions: '자기소개를 해 주세요',
  retrospective: '답변이 길었다',
};

async function openPage() {
  window.history.replaceState(null, '', '/applications/1');
  render(<App />);
  return screen.findByRole('region', { name: 'Interviews' });
}

test('an interview is added and listed by date', async () => {
  const calls = serve([
    {
      ...first,
      id: 2,
      round: 2,
      date: '2026-12-01',
      time: '15:30',
      format: 'onsite',
      questions: null,
      retrospective: null,
    },
  ]);
  const user = userEvent.setup();
  const section = await openPage();
  await within(section).findByRole('list', { name: 'Interview list' });

  await user.click(within(section).getByRole('button', { name: 'Add interview' }));
  // The next round is suggested; the form starts empty otherwise.
  expect(within(section).getByLabelText('Round')).toHaveValue('3');
  await user.clear(within(section).getByLabelText('Round'));
  await user.type(within(section).getByLabelText('Round'), '1');
  await user.type(within(section).getByLabelText('Date'), '2026-11-20');
  await user.type(within(section).getByLabelText('Time (Seoul)'), '09:30');
  await user.type(within(section).getByLabelText('Questions asked'), '협업 경험');
  await user.click(within(section).getByRole('button', { name: 'Add interview', description: '' }));

  const post = calls.find((call) => call.method === 'POST');
  expect(post?.body).toMatchObject({
    round: 1,
    date: '2026-11-20',
    time: '09:30',
    format: 'video',
    questions: '협업 경험',
  });
  await waitFor(() =>
    expect(
      within(section)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Round 1 · Video call', 'Round 2 · On site']),
  );
  expect(within(section).queryByRole('form')).not.toBeInTheDocument();
});

test('a server message appears under its field and the form stays open', async () => {
  serve([]);
  const user = userEvent.setup();
  const section = await openPage();
  expect(await within(section).findByText('No interviews yet')).toBeInTheDocument();
  await user.click(within(section).getByRole('button', { name: 'Add interview' }));
  await user.click(within(section).getByRole('button', { name: 'Add interview', description: '' }));
  expect(
    await within(section).findByText('Date must be a date in YYYY-MM-DD format'),
  ).toBeInTheDocument();
  expect(within(section).getByLabelText('Date')).toBeInvalid();
});

test('an interview is edited and deleted after a confirmation', async () => {
  const calls = serve([first]);
  const user = userEvent.setup();
  const section = await openPage();
  const item = await within(section).findByRole('listitem', { name: 'Round 1 · Phone' });
  expect(item).toHaveTextContent('Done');
  expect(item).toHaveTextContent('November 2, 2026 · 10:00');
  expect(item).toHaveTextContent('자기소개를 해 주세요');
  expect(item).toHaveTextContent('답변이 길었다');

  await user.click(within(item).getByRole('button', { name: 'Edit round 1' }));
  const retrospective = within(section).getByLabelText('Retrospective');
  expect(retrospective).toHaveValue('답변이 길었다');
  await user.clear(retrospective);
  await user.type(retrospective, '다음엔 짧게');
  await user.click(within(section).getByRole('button', { name: 'Save interview' }));
  await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
  expect(calls.find((call) => call.method === 'PUT')?.body).toMatchObject({
    round: 1,
    date: '2026-11-02',
    time: '10:00',
    retrospective: '다음엔 짧게',
  });
  expect(await within(section).findByText('다음엔 짧게')).toBeInTheDocument();

  await user.click(within(section).getByRole('button', { name: 'Delete round 1' }));
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await within(section).findByText('No interviews yet')).toBeInTheDocument();
  expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
});
