import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import {
  type Career,
  careerFieldErrors,
  emptyCareerForm,
  toCareerForm,
  toCareerInput,
} from './career-data';
import { toast } from './components/ui/sonner';

// All companies here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const past: Career = {
  id: 1,
  company: '한빛소프트',
  department: '커머스개발팀',
  position: '주임',
  employmentType: 'full_time',
  startDate: '2019-02-11',
  endDate: '2023-12-29',
  duties: '주문 API 개발',
  achievements: null,
};

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with a 400 and that Korean message, as the server would.
 */
function fakeApi(rows: Career[]) {
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
      if (method === 'GET') return json({ careers: store });
      // The server stores blank text as NULL.
      const saved = (input: Career) =>
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
        ) as Career;
      if (method === 'POST') {
        const career = saved({ ...(body as Career), id: nextId++ });
        store.unshift(career);
        return json({ career }, 201);
      }
      if (index === -1) return json({ error: '이력을 찾을 수 없습니다' }, 404);
      if (method === 'PUT') {
        store[index] = saved({ ...(body as Career), id });
        return json({ career: store[index] });
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

test('a new career with no end date is sent as a job still held and listed as 재직 중', async () => {
  const api = fakeApi([]);
  open('/careers');
  fireEvent.click(await screen.findByRole('link', { name: '이력 추가' }));
  expect(await screen.findByRole('heading', { level: 1, name: '이력 추가' })).toBeInTheDocument();

  type('회사명', '구름데이터');
  type('직책', '선임 개발자');
  fireEvent.change(field('고용 형태'), { target: { value: 'contract' } });
  type('입사일', '2024-01-02');
  type('담당 업무', '데이터 수집 API');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  expect(await screen.findByRole('heading', { level: 1, name: '이력' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/careers');
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    company: '구름데이터',
    department: '',
    position: '선임 개발자',
    employmentType: 'contract',
    startDate: '2024-01-02',
    endDate: null,
    duties: '데이터 수집 API',
    achievements: '',
  });
  const list = await screen.findByRole('list', { name: '이력 목록' });
  const item = within(list).getByRole('listitem', { name: '구름데이터' });
  expect(item).toHaveTextContent('2024-01-02 ~ 재직 중');
  expect(item).toHaveTextContent('선임 개발자 · 계약직');
});

test('the end date hint says an empty date means a job still held', async () => {
  fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: '이력 추가' });
  expect(field('퇴사일')).toHaveAccessibleDescription(
    '지금 다니는 회사면 비워 둡니다. 목록에 "재직 중"으로 보입니다.',
  );
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: '이력 추가' });
  type('회사명', '한빛소프트');
  type('입사일', '2023-03-02');
  type('퇴사일', '2020-02-28');
  api.refuseNext('퇴사일은 입사일보다 빠를 수 없습니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  await waitFor(() => expect(field('퇴사일')).toHaveAttribute('aria-invalid', 'true'));
  expect(field('퇴사일')).toHaveAccessibleDescription(
    expect.stringContaining('퇴사일은 입사일보다 빠를 수 없습니다'),
  );
  await waitFor(() => expect(field('퇴사일')).toHaveFocus());
  expect(field('입사일')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('회사명')).toHaveValue('한빛소프트');
  expect(window.location.pathname).toBe('/careers/new');
});

test('each joined server message is shown under its own field, topmost focused', async () => {
  const api = fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: '이력 추가' });
  api.refuseNext('입사일은(는) YYYY-MM-DD 형식의 날짜여야 합니다, 회사명을(를) 입력해 주세요');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('회사명')).toHaveFocus());
  expect(field('회사명')).toHaveAccessibleDescription('회사명을(를) 입력해 주세요');
  expect(field('입사일')).toHaveAccessibleDescription(
    '입사일은(는) YYYY-MM-DD 형식의 날짜여야 합니다',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/careers/new');
  await screen.findByRole('heading', { level: 1, name: '이력 추가' });
  api.refuseNext('입력에 사용할 수 없는 문자(NUL)가 있습니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    '입력에 사용할 수 없는 문자(NUL)가 있습니다',
  );
  await waitFor(() => expect(screen.getByRole('button', { name: '추가' })).toHaveFocus());
});

test('a career is edited with its saved values filled in', async () => {
  const api = fakeApi([past]);
  open('/careers');
  fireEvent.click(await screen.findByRole('link', { name: '한빛소프트 수정' }));
  expect(await screen.findByRole('heading', { level: 1, name: '이력 수정' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/careers/1/edit');
  expect(field('회사명')).toHaveValue('한빛소프트');
  expect(field('고용 형태')).toHaveValue('full_time');
  expect(field('퇴사일')).toHaveValue('2023-12-29');
  expect(field('주요 성과')).toHaveValue('');

  type('주요 성과', '정산 배치 시간 단축');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('heading', { level: 1, name: '이력' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/careers/1');
  expect(put?.body).toMatchObject({ achievements: '정산 배치 시간 단축', endDate: '2023-12-29' });
  expect(await screen.findByText('정산 배치 시간 단축')).toBeInTheDocument();
});

test('clearing the end date of a past job makes it 재직 중', async () => {
  const api = fakeApi([past]);
  open('/careers/1/edit');
  await screen.findByRole('heading', { level: 1, name: '이력 수정' });
  type('퇴사일', '');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const item = await screen.findByRole('listitem', { name: '한빛소프트' });
  expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ endDate: null });
  expect(item).toHaveTextContent('2019-02-11 ~ 재직 중');
});

test('editing a career that no longer exists says so', async () => {
  fakeApi([]);
  open('/careers/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('이력을 찾을 수 없습니다');
});

test('cancelling the delete dialog keeps the career', async () => {
  const api = fakeApi([past]);
  open('/careers');
  fireEvent.click(await screen.findByRole('button', { name: '한빛소프트 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '이력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: '한빛소프트' })).toBeInTheDocument();
});

test('confirming the delete removes the career and moves focus to the page title', async () => {
  const api = fakeApi([past]);
  open('/careers');
  fireEvent.click(await screen.findByRole('button', { name: '한빛소프트 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '이력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 이력이 없습니다' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/careers/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("'한빛소프트' 이력을 지웠습니다")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: '이력' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([past]);
  api.failDeletes(503, '데이터베이스에 연결할 수 없습니다');
  open('/careers');
  fireEvent.click(await screen.findByRole('button', { name: '한빛소프트 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '이력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByText('이력을 지우지 못했습니다. 데이터베이스에 연결할 수 없습니다'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '이력을 지울까요?' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { hidden: true, name: '한빛소프트' })).toBeInTheDocument();
});

test('a row that is already gone (404) counts as deleted', async () => {
  const api = fakeApi([past]);
  api.failDeletes(404, '이력을 찾을 수 없습니다');
  open('/careers');
  await screen.findByRole('listitem', { name: '한빛소프트' });
  // Someone else deleted it after the list loaded.
  api.store.splice(0, 1);
  fireEvent.click(await screen.findByRole('button', { name: '한빛소프트 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '이력을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('listitem', { name: '한빛소프트' })).not.toBeInTheDocument();
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => careerFieldErrors(message)[0]?.field;
  expect(fieldOf('회사명을(를) 입력해 주세요')).toBe('company');
  expect(fieldOf('부서은(는) 100자 이하여야 합니다')).toBe('department');
  expect(fieldOf('직책은(는) 100자 이하여야 합니다')).toBe('position');
  expect(fieldOf('입사일은(는) YYYY-MM-DD 형식의 날짜여야 합니다')).toBe('startDate');
  expect(fieldOf('퇴사일은 입사일보다 빠를 수 없습니다')).toBe('endDate');
  expect(fieldOf('담당 업무은(는) 2000자 이하여야 합니다')).toBe('duties');
  expect(fieldOf('주요 성과은(는) 2000자 이하여야 합니다')).toBe('achievements');
  expect(fieldOf('요청 본문은 JSON 객체여야 합니다')).toBeUndefined();
  // The employment type message holds commas of its own; it stays one message.
  expect(
    careerFieldErrors(
      '고용 형태는 정규직, 계약직, 인턴, 프리랜서, 기타 중 하나여야 합니다, 회사명을(를) 입력해 주세요',
    ),
  ).toEqual([
    { field: 'company', message: '회사명을(를) 입력해 주세요' },
    {
      field: 'employmentType',
      message: '고용 형태는 정규직, 계약직, 인턴, 프리랜서, 기타 중 하나여야 합니다',
    },
  ]);
});

test('form values become the API input and back', () => {
  expect(toCareerInput({ ...emptyCareerForm, endDate: '' }).endDate).toBeNull();
  expect(toCareerInput({ ...emptyCareerForm, endDate: '2023-12-29' }).endDate).toBe('2023-12-29');
  expect(toCareerForm({ ...past, department: null, endDate: null })).toMatchObject({
    department: '',
    endDate: '',
    achievements: '',
  });
});
