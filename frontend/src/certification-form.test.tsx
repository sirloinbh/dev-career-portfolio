import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
 * answers the next POST or PUT with a 400 and that Korean message, as the server would.
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
      if (index === -1) return json({ error: '자격증을 찾을 수 없습니다' }, 404);
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

test('a new certification with no expiry date is sent as null and listed as 만료 없음', async () => {
  const api = fakeApi([]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('link', { name: '자격증 추가' }));
  expect(await screen.findByRole('heading', { level: 1, name: '자격증 추가' })).toBeInTheDocument();

  type('자격증명', '정보처리기사');
  type('발급 기관', '한국산업인력공단');
  type('취득일', '2021-08-20');
  type('메모', '실기 2회 응시');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  expect(await screen.findByRole('heading', { level: 1, name: '자격증' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/certifications');
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    name: '정보처리기사',
    issuer: '한국산업인력공단',
    acquiredDate: '2021-08-20',
    expiryDate: null,
    score: '',
    memo: '실기 2회 응시',
  });
  const list = await screen.findByRole('list', { name: '자격증 목록' });
  const item = within(list).getByRole('listitem', { name: '정보처리기사' });
  expect(item).toHaveTextContent('취득 2021-08-20 · 만료 없음');
  expect(item).toHaveTextContent('실기 2회 응시');
  expect(await screen.findByText("'정보처리기사' 자격증을 추가했습니다")).toBeInTheDocument();
});

test('the expiry date hint says an empty date means it never expires', async () => {
  fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: '자격증 추가' });
  expect(field('만료일')).toHaveAccessibleDescription(
    '만료일이 없는 자격증이면 비워 둡니다. 목록에 "만료 없음"으로 보입니다.',
  );
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: '자격증 추가' });
  type('자격증명', 'TOEIC');
  type('발급 기관', 'ETS');
  type('취득일', '2025-03-09');
  type('만료일', '2024-03-08');
  api.refuseNext('만료일은 취득일보다 빠를 수 없습니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  await waitFor(() => expect(field('만료일')).toHaveAttribute('aria-invalid', 'true'));
  expect(field('만료일')).toHaveAccessibleDescription(
    expect.stringContaining('만료일은 취득일보다 빠를 수 없습니다'),
  );
  await waitFor(() => expect(field('만료일')).toHaveFocus());
  expect(field('취득일')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('자격증명')).toHaveValue('TOEIC');
  expect(window.location.pathname).toBe('/certifications/new');
});

test('each joined server message is shown under its own field, topmost focused', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: '자격증 추가' });
  api.refuseNext(
    '점수·등급은(는) 50자 이하여야 합니다, 발급 기관을(를) 입력해 주세요, 자격증명을(를) 입력해 주세요',
  );
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('자격증명')).toHaveFocus());
  expect(field('자격증명')).toHaveAccessibleDescription('자격증명을(를) 입력해 주세요');
  expect(field('발급 기관')).toHaveAccessibleDescription('발급 기관을(를) 입력해 주세요');
  expect(field('점수·등급')).toHaveAccessibleDescription('점수·등급은(는) 50자 이하여야 합니다');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: '자격증 추가' });
  api.refuseNext('입력에 사용할 수 없는 문자(NUL)가 있습니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '입력에 사용할 수 없는 문자(NUL)가 있습니다',
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '추가' })).toHaveFocus());
});

test('a certification is edited with its saved values filled in', async () => {
  const api = fakeApi([toeic]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('link', { name: 'TOEIC 수정' }));
  expect(await screen.findByRole('heading', { level: 1, name: '자격증 수정' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/certifications/1/edit');
  expect(field('자격증명')).toHaveValue('TOEIC');
  expect(field('발급 기관')).toHaveValue('ETS');
  expect(field('취득일')).toHaveValue('2025-03-09');
  expect(field('만료일')).toHaveValue('2027-03-08');
  expect(field('점수·등급')).toHaveValue('905점');
  expect(field('메모')).toHaveValue('');

  type('점수·등급', '950점');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('heading', { level: 1, name: '자격증' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/certifications/1');
  expect(put?.body).toMatchObject({ score: '950점', expiryDate: '2027-03-08' });
  expect(await screen.findByText('ETS · 950점')).toBeInTheDocument();
});

test('clearing the expiry date makes the certification 만료 없음', async () => {
  const api = fakeApi([toeic]);
  open('/certifications/1/edit');
  await screen.findByRole('heading', { level: 1, name: '자격증 수정' });
  type('만료일', '');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const item = await screen.findByRole('listitem', { name: 'TOEIC' });
  expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({
    expiryDate: null,
  });
  expect(item).toHaveTextContent('취득 2025-03-09 · 만료 없음');
});

test('editing a certification that no longer exists says so', async () => {
  fakeApi([]);
  open('/certifications/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('자격증을 찾을 수 없습니다');
});

test('cancelling the delete dialog keeps the certification', async () => {
  const api = fakeApi([toeic]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('button', { name: 'TOEIC 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '자격증을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: 'TOEIC' })).toBeInTheDocument();
});

test('confirming the delete removes the certification and moves focus to the page title', async () => {
  const api = fakeApi([toeic]);
  open('/certifications');
  fireEvent.click(await screen.findByRole('button', { name: 'TOEIC 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '자격증을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 자격증이 없습니다' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/certifications/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("'TOEIC' 자격증을 지웠습니다")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: '자격증' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([toeic]);
  api.failDeletes(503, '데이터베이스에 연결할 수 없습니다');
  open('/certifications');
  fireEvent.click(await screen.findByRole('button', { name: 'TOEIC 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '자격증을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByText('자격증을 지우지 못했습니다. 데이터베이스에 연결할 수 없습니다'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '자격증을 지울까요?' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { hidden: true, name: 'TOEIC' })).toBeInTheDocument();
});

test('a half-typed expiry date is sent as text the server refuses, not as never expiring', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: '자격증 추가' });
  type('자격증명', 'TOEIC');
  type('발급 기관', 'ETS');
  type('취득일', '2025-03-09');
  // A browser reads an unfinished date ("2027-03-__") as '' and flags it as bad input.
  Object.defineProperty(field('만료일'), 'validity', { value: { badInput: true } });
  api.refuseNext('만료일은(는) YYYY-MM-DD 형식의 날짜여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('만료일')).toHaveFocus());
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    expiryDate: 'incomplete',
  });
  expect(field('만료일')).toHaveAccessibleDescription(
    expect.stringContaining('만료일은(는) YYYY-MM-DD 형식의 날짜여야 합니다'),
  );
  expect(api.store).toHaveLength(0);
});

test('the form can be filled and saved with the keyboard alone', async () => {
  const api = fakeApi([]);
  open('/certifications/new');
  await screen.findByRole('heading', { level: 1, name: '자격증 추가' });
  // Every input is a native, labelled control in screen order, and Enter in a text input submits.
  const inputs = ['자격증명', '발급 기관', '취득일', '만료일', '점수·등급', '메모'].map(field);
  for (const input of inputs) expect(input).not.toHaveAttribute('tabindex', '-1');
  const order = inputs.map((input) => input.compareDocumentPosition(inputs[0]));
  expect(order.slice(1).every((position) => position & Node.DOCUMENT_POSITION_PRECEDING)).toBe(
    true,
  );
  type('자격증명', 'SQLD');
  type('발급 기관', '한국데이터산업진흥원');
  type('취득일', '2023-06-23');
  fireEvent.submit(field('자격증명').closest('form') as HTMLFormElement);
  expect(await screen.findByRole('heading', { level: 1, name: '자격증' })).toBeInTheDocument();
  expect(api.store).toHaveLength(1);
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => certificationFieldErrors(message)[0]?.field;
  expect(fieldOf('자격증명을(를) 입력해 주세요')).toBe('name');
  expect(fieldOf('발급 기관은(는) 100자 이하여야 합니다')).toBe('issuer');
  expect(fieldOf('취득일은(는) YYYY-MM-DD 형식의 날짜여야 합니다')).toBe('acquiredDate');
  expect(fieldOf('만료일은 취득일보다 빠를 수 없습니다')).toBe('expiryDate');
  expect(fieldOf('점수·등급은(는) 문자열이어야 합니다')).toBe('score');
  expect(fieldOf('메모은(는) 2000자 이하여야 합니다')).toBe('memo');
  expect(fieldOf('요청 본문은 JSON 객체여야 합니다')).toBeUndefined();
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
