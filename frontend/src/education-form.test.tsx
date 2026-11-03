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
 * answers the next POST or PUT with a 400 and that Korean message, as the server would.
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
      if (index === -1) return json({ error: '학력을 찾을 수 없습니다' }, 404);
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
  fireEvent.click(await screen.findByRole('link', { name: '학력 추가' }));
  expect(await screen.findByRole('heading', { level: 1, name: '학력 추가' })).toBeInTheDocument();

  type('학교명', '한빛대학교 소프트웨어대학원');
  fireEvent.change(field('학위'), { target: { value: 'master' } });
  fireEvent.change(field('상태'), { target: { value: 'enrolled' } });
  type('입학일', '2024-03-04');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  expect(await screen.findByRole('heading', { level: 1, name: '학력' })).toBeInTheDocument();
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
  const list = await screen.findByRole('list', { name: '학력 목록' });
  expect(
    within(list).getByRole('listitem', { name: '한빛대학교 소프트웨어대학원' }),
  ).toBeInTheDocument();
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: '학력 추가' });
  type('학교명', '한빛대학교');
  type('입학일', '2019-03-02');
  type('졸업일', '2015-02-20');
  api.refuseNext('졸업일은 입학일보다 빠를 수 없습니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  await waitFor(() => expect(field('졸업일')).toHaveAttribute('aria-invalid', 'true'));
  expect(field('졸업일')).toHaveAccessibleDescription(
    expect.stringContaining('졸업일은 입학일보다 빠를 수 없습니다'),
  );
  await waitFor(() => expect(field('졸업일')).toHaveFocus());
  expect(field('입학일')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('학교명')).toHaveValue('한빛대학교');
  expect(window.location.pathname).toBe('/educations/new');
});

test('a message that names no field is shown below the form', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: '학력 추가' });
  api.refuseNext('입력에 사용할 수 없는 문자(NUL)가 있습니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '입력에 사용할 수 없는 문자(NUL)가 있습니다',
  );
});

test('choosing 재학 중 clears and locks the graduation date', async () => {
  fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: '학력 추가' });
  type('졸업일', '2019-02-20');
  fireEvent.change(field('상태'), { target: { value: 'enrolled' } });
  expect(field('졸업일')).toHaveValue('');
  expect(field('졸업일')).toBeDisabled();
});

test('an education is edited with its saved values filled in', async () => {
  const api = fakeApi([university]);
  open('/educations');
  fireEvent.click(await screen.findByRole('link', { name: '한빛대학교 수정' }));
  expect(await screen.findByRole('heading', { level: 1, name: '학력 수정' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/educations/1/edit');
  expect(field('학교명')).toHaveValue('한빛대학교');
  expect(field('학점')).toHaveValue('3.75');
  expect(field('만점')).toHaveValue('4.5');

  type('전공', '소프트웨어공학');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('heading', { level: 1, name: '학력' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/educations/1');
  expect(put?.body).toMatchObject({ major: '소프트웨어공학', gpa: 3.75, gpaScale: 4.5 });
  expect(await screen.findByText(/학사 · 소프트웨어공학/)).toBeInTheDocument();
});

test('editing an education that no longer exists says so', async () => {
  fakeApi([]);
  open('/educations/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('학력을 찾을 수 없습니다');
});

test('cancelling the delete dialog keeps the education', async () => {
  const api = fakeApi([university]);
  open('/educations');
  fireEvent.click(await screen.findByRole('button', { name: '한빛대학교 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '학력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(screen.getByRole('listitem', { name: '한빛대학교' })).toBeInTheDocument();
});

test('confirming the delete removes the education and moves focus to the page title', async () => {
  const api = fakeApi([university]);
  open('/educations');
  fireEvent.click(await screen.findByRole('button', { name: '한빛대학교 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '학력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 학력이 없습니다' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/educations/1');
  expect(api.store).toHaveLength(0);
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: '학력' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([university]);
  api.failDeletes(503, '데이터베이스에 연결할 수 없습니다');
  open('/educations');
  fireEvent.click(await screen.findByRole('button', { name: '한빛대학교 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '학력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByText('학력을 지우지 못했습니다. 데이터베이스에 연결할 수 없습니다'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '학력을 지울까요?' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { hidden: true, name: '한빛대학교' })).toBeInTheDocument();
});

test('a row that is already gone (404) counts as deleted', async () => {
  const api = fakeApi([university]);
  api.failDeletes(404, '학력을 찾을 수 없습니다');
  open('/educations');
  await screen.findByRole('listitem', { name: '한빛대학교' });
  // Someone else deleted it after the list loaded.
  api.store.splice(0, 1);
  fireEvent.click(await screen.findByRole('button', { name: '한빛대학교 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '학력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('listitem', { name: '한빛대학교' })).not.toBeInTheDocument();
});

test('text that is not a number reaches the server as typed', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: '학력 추가' });
  type('학점', '3..5');
  type('만점', '4.5');
  api.refuseNext('학점은(는) 숫자여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() =>
    expect(field('학점')).toHaveAccessibleDescription(/학점은\(는\) 숫자여야 합니다/),
  );
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    gpa: '3..5',
    gpaScale: 4.5,
  });
});

test('choosing 재학 중 also clears a message about the graduation date', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: '학력 추가' });
  type('졸업일', '2015-02-20');
  api.refuseNext('졸업일은 입학일보다 빠를 수 없습니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('졸업일')).toHaveAttribute('aria-invalid', 'true'));
  fireEvent.change(field('상태'), { target: { value: 'enrolled' } });
  expect(field('졸업일')).not.toHaveAttribute('aria-invalid');
  expect(screen.queryByText('졸업일은 입학일보다 빠를 수 없습니다')).not.toBeInTheDocument();
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => fieldErrors(message)[0]?.field;
  expect(fieldOf('학교명을(를) 입력해 주세요')).toBe('school');
  expect(fieldOf('입학일은(는) YYYY-MM-DD 형식의 날짜여야 합니다')).toBe('startDate');
  expect(fieldOf('졸업일은 입학일보다 빠를 수 없습니다')).toBe('endDate');
  expect(fieldOf('재학 중이면 졸업일을 비워 주세요')).toBe('endDate');
  expect(fieldOf('학점과 만점은 함께 입력해 주세요')).toBe('gpa');
  expect(fieldOf('만점은 0보다 커야 합니다')).toBe('gpaScale');
  expect(fieldOf('메모은(는) 2000자 이하여야 합니다')).toBe('memo');
  expect(fieldOf('요청 본문은 JSON 객체여야 합니다')).toBeUndefined();
});

test('several joined messages are split per field, keeping commas inside one message', () => {
  expect(
    fieldErrors(
      '입학일은(는) YYYY-MM-DD 형식의 날짜여야 합니다, 학위는 고등학교, 전문학사, 학사, 석사, 박사, 기타 중 하나여야 합니다, 외 2개',
    ),
  ).toEqual([
    { field: 'startDate', message: '입학일은(는) YYYY-MM-DD 형식의 날짜여야 합니다' },
    {
      field: 'degree',
      message: '학위는 고등학교, 전문학사, 학사, 석사, 박사, 기타 중 하나여야 합니다, 외 2개',
    },
  ]);
});

test('two messages about one field are kept even with another field between them', () => {
  expect(
    fieldErrors(
      '학점은(는) 소수 둘째 자리까지 입력해 주세요, 만점은(는) 소수 둘째 자리까지 입력해 주세요, 학점은 만점보다 클 수 없습니다',
    ),
  ).toEqual([
    {
      field: 'gpa',
      message: '학점은(는) 소수 둘째 자리까지 입력해 주세요, 학점은 만점보다 클 수 없습니다',
    },
    { field: 'gpaScale', message: '만점은(는) 소수 둘째 자리까지 입력해 주세요' },
  ]);
});

test('each joined server message is shown under its own field', async () => {
  const api = fakeApi([]);
  open('/educations/new');
  await screen.findByRole('heading', { level: 1, name: '학력 추가' });
  api.refuseNext('학교명을(를) 입력해 주세요, 입학일은(는) YYYY-MM-DD 형식의 날짜여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('학교명')).toHaveFocus());
  expect(field('학교명')).toHaveAccessibleDescription('학교명을(를) 입력해 주세요');
  expect(field('입학일')).toHaveAccessibleDescription(
    '입학일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('form values become the API input and back', () => {
  expect(toEducationInput({ ...emptyEducationForm, gpa: ' 3.5 ', gpaScale: 'abc' })).toMatchObject({
    endDate: null,
    gpa: 3.5,
    // Not a number: sent as typed so the server explains in Korean.
    gpaScale: 'abc',
  });
  expect(toEducationForm({ ...university, major: null, gpa: null, gpaScale: null })).toMatchObject({
    major: '',
    gpa: '',
    gpaScale: '',
    endDate: '2019-02-20',
  });
});
