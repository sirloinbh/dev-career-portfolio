import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { toast } from './components/ui/sonner';
import {
  emptyProjectForm,
  type Project,
  projectFieldErrors,
  splitTechnologies,
  toProjectForm,
  toProjectInput,
} from './project-data';

// All projects here are made up for the test.

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

const past: Project = {
  id: 1,
  name: '사내 위키 검색',
  organization: '한빛소프트',
  startDate: '2021-03-02',
  endDate: '2021-08-31',
  role: '프론트엔드',
  summary: null,
  contributions: null,
  technologies: ['React', 'Elasticsearch'],
  repositoryUrl: 'https://github.com/example/wiki',
  serviceUrl: null,
};

type Call = { method: string; url: string; body: unknown };

/**
 * A small in-memory API: GET lists the rows, POST and PUT store the body, DELETE removes. `refuse`
 * answers the next POST or PUT with a 400 and that Korean message, as the server would.
 */
function fakeApi(rows: Project[]) {
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
      if (method === 'GET') return json({ projects: store });
      // The server stores blank text as NULL.
      const saved = (input: Project) =>
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [key, value === '' ? null : value]),
        ) as Project;
      if (method === 'POST') {
        const project = saved({ ...(body as Project), id: nextId++ });
        store.unshift(project);
        return json({ project }, 201);
      }
      if (index === -1) return json({ error: '프로젝트를 찾을 수 없습니다' }, 404);
      if (method === 'PUT') {
        store[index] = saved({ ...(body as Project), id });
        return json({ project: store[index] });
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
const postBody = (api: { calls: Call[] }) => api.calls.find((call) => call.method === 'POST')?.body;

test('a new project with no end date is sent as running and listed as 진행 중', async () => {
  const api = fakeApi([]);
  open('/projects');
  fireEvent.click(await screen.findByRole('link', { name: '프로젝트 추가' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: '프로젝트 추가' }),
  ).toBeInTheDocument();

  type('프로젝트명', '주문 정산 자동화');
  type('역할', '백엔드 개발');
  type('시작일', '2024-05-01');
  type('사용 기술', ' TypeScript, PostgreSQL ,, AWS Lambda, ');
  type('저장소 링크', 'https://github.com/example/settlement');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  expect(await screen.findByRole('heading', { level: 1, name: '프로젝트' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/projects');
  expect(postBody(api)).toEqual({
    name: '주문 정산 자동화',
    organization: '',
    startDate: '2024-05-01',
    endDate: null,
    role: '백엔드 개발',
    summary: '',
    contributions: '',
    // Pieces are trimmed and the empty ones from extra commas dropped.
    technologies: ['TypeScript', 'PostgreSQL', 'AWS Lambda'],
    repositoryUrl: 'https://github.com/example/settlement',
    serviceUrl: '',
  });
  const item = await screen.findByRole('listitem', { name: '주문 정산 자동화' });
  expect(item).toHaveTextContent('2024-05-01 ~ 진행 중');
  expect(within(item).getByRole('link', { name: /저장소/ })).toHaveAttribute(
    'href',
    'https://github.com/example/settlement',
  );
  expect(await screen.findByText("'주문 정산 자동화' 프로젝트를 추가했습니다")).toBeInTheDocument();
});

test('the hints say how to leave a project running and how to list technologies', async () => {
  fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 추가' });
  expect(field('종료일')).toHaveAccessibleDescription(
    '진행 중인 프로젝트면 비워 둡니다. 목록에 "진행 중"으로 보입니다.',
  );
  expect(field('사용 기술')).toHaveAccessibleDescription(
    '쉼표(,)로 나눠 적습니다. 항목마다 50자, 30개까지 넣을 수 있습니다.',
  );
  expect(field('저장소 링크')).toHaveAccessibleDescription(
    'http:// 또는 https://로 시작하는 주소를 넣습니다.',
  );
  expect(field('저장소 링크')).toHaveAttribute('type', 'url');
});

test('the server message is shown under the field it is about, and focus moves there', async () => {
  const api = fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 추가' });
  type('프로젝트명', '사내 위키 검색');
  type('시작일', '2021-03-02');
  type('저장소 링크', 'github.com/example/wiki');
  api.refuseNext('저장소 링크은(는) http:// 또는 https://로 시작하는 주소여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  await waitFor(() => expect(field('저장소 링크')).toHaveFocus());
  expect(field('저장소 링크')).toHaveAttribute('aria-invalid', 'true');
  expect(field('저장소 링크')).toHaveAccessibleDescription(
    expect.stringContaining('저장소 링크은(는) http:// 또는 https://로 시작하는 주소여야 합니다'),
  );
  expect(field('서비스 링크')).not.toHaveAttribute('aria-invalid');
  // The form keeps what was typed.
  expect(field('프로젝트명')).toHaveValue('사내 위키 검색');
  expect(window.location.pathname).toBe('/projects/new');
});

test('a repeated message about technologies is shown once, topmost field focused', async () => {
  const api = fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 추가' });
  // One issue per item that is too long, then the name; as the server joins them.
  api.refuseNext(
    '사용 기술 항목은 50자 이하여야 합니다, 사용 기술 항목은 50자 이하여야 합니다, 프로젝트명을(를) 입력해 주세요',
  );
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('프로젝트명')).toHaveFocus());
  expect(field('프로젝트명')).toHaveAccessibleDescription('프로젝트명을(를) 입력해 주세요');
  expect(field('사용 기술')).toHaveAccessibleDescription(
    '쉼표(,)로 나눠 적습니다. 항목마다 50자, 30개까지 넣을 수 있습니다. 사용 기술 항목은 50자 이하여야 합니다',
  );
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a long list of the same message keeps the count of the ones not shown', () => {
  const message = '사용 기술 항목은 50자 이하여야 합니다';
  // Ten issues, then the count of the rest; as backend/src/standard/http.ts joins them.
  expect(projectFieldErrors([...Array<string>(10).fill(message), '외 1개'].join(', '))).toEqual([
    { field: 'technologies', message: `${message}, 외 1개` },
  ]);
});

test('a half-typed end date is sent as text the server refuses, not as running', async () => {
  const api = fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 추가' });
  // A browser reads an unfinished date ("2023-12-__") as '' and flags it as bad input.
  Object.defineProperty(field('종료일'), 'validity', { value: { badInput: true } });
  api.refuseNext('종료일은(는) YYYY-MM-DD 형식의 날짜여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('종료일')).toHaveFocus());
  expect(postBody(api)).toMatchObject({ endDate: 'incomplete' });
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/projects/new');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 추가' });
  api.refuseNext('요청 본문은 JSON 객체여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('요청 본문은 JSON 객체여야 합니다');
  await waitFor(() => expect(screen.getByRole('button', { name: '추가' })).toHaveFocus());
});

test('a project is edited with its saved values filled in', async () => {
  const api = fakeApi([past]);
  open('/projects');
  fireEvent.click(await screen.findByRole('link', { name: '사내 위키 검색 수정' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: '프로젝트 수정' }),
  ).toBeInTheDocument();
  expect(window.location.pathname).toBe('/projects/1/edit');
  expect(field('프로젝트명')).toHaveValue('사내 위키 검색');
  expect(field('종료일')).toHaveValue('2021-08-31');
  expect(field('사용 기술')).toHaveValue('React, Elasticsearch');
  expect(field('저장소 링크')).toHaveValue('https://github.com/example/wiki');
  expect(field('서비스 링크')).toHaveValue('');

  type('사용 기술', 'React, Elasticsearch, Redis');
  type('저장소 링크', '');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('heading', { level: 1, name: '프로젝트' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/projects/1');
  expect(put?.body).toMatchObject({
    technologies: ['React', 'Elasticsearch', 'Redis'],
    repositoryUrl: '',
    endDate: '2021-08-31',
  });
  const item = await screen.findByRole('listitem', { name: '사내 위키 검색' });
  expect(item).toHaveTextContent('Redis');
  // The cleared link is gone from the list.
  expect(within(item).queryByRole('link', { name: /저장소/ })).not.toBeInTheDocument();
});

test('a refused edit shows the message under its field and stays on the form', async () => {
  const api = fakeApi([past]);
  open('/projects/1/edit');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 수정' });
  type('시작일', '2022-01-03');
  api.refuseNext('종료일은 시작일보다 빠를 수 없습니다');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  await waitFor(() => expect(field('종료일')).toHaveFocus());
  expect(field('종료일')).toHaveAccessibleDescription(
    expect.stringContaining('종료일은 시작일보다 빠를 수 없습니다'),
  );
  expect(api.calls.find((call) => call.method === 'PUT')?.url).toBe('/api/projects/1');
  expect(field('시작일')).toHaveValue('2022-01-03');
  expect(window.location.pathname).toBe('/projects/1/edit');
});

test('saving a project deleted after the form opened says it is gone', async () => {
  const api = fakeApi([past]);
  open('/projects/1/edit');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 수정' });
  // Someone else deleted it after the form loaded.
  api.store.splice(0, 1);
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('프로젝트를 찾을 수 없습니다');
  await waitFor(() => expect(screen.getByRole('button', { name: '저장' })).toHaveFocus());
  expect(window.location.pathname).toBe('/projects/1/edit');
});

test('clearing the end date of a finished project makes it 진행 중', async () => {
  const api = fakeApi([past]);
  open('/projects/1/edit');
  await screen.findByRole('heading', { level: 1, name: '프로젝트 수정' });
  type('종료일', '');
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  const item = await screen.findByRole('listitem', { name: '사내 위키 검색' });
  expect(api.calls.find((call) => call.method === 'PUT')?.body).toMatchObject({ endDate: null });
  expect(item).toHaveTextContent('2021-03-02 ~ 진행 중');
});

test('editing a project that no longer exists says so', async () => {
  fakeApi([]);
  open('/projects/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('프로젝트를 찾을 수 없습니다');
});

test('cancelling the delete dialog keeps the project', async () => {
  const api = fakeApi([past]);
  open('/projects');
  fireEvent.click(await screen.findByRole('button', { name: '사내 위키 검색 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '프로젝트를 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: '사내 위키 검색' })).toBeInTheDocument();
});

test('confirming the delete removes the project and moves focus to the page title', async () => {
  const api = fakeApi([past]);
  open('/projects');
  fireEvent.click(await screen.findByRole('button', { name: '사내 위키 검색 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '프로젝트를 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 프로젝트가 없습니다' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/projects/1');
  expect(api.store).toHaveLength(0);
  // 프로젝트 ends in a vowel, so the particle is 를.
  expect(await screen.findByText("'사내 위키 검색' 프로젝트를 지웠습니다")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: '프로젝트' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([past]);
  api.failDeletes(503, '데이터베이스에 연결할 수 없습니다');
  open('/projects');
  fireEvent.click(await screen.findByRole('button', { name: '사내 위키 검색 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '프로젝트를 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByText('프로젝트를 지우지 못했습니다. 데이터베이스에 연결할 수 없습니다'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '프로젝트를 지울까요?' })).toBeInTheDocument();
  expect(
    screen.getByRole('listitem', { hidden: true, name: '사내 위키 검색' }),
  ).toBeInTheDocument();
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => projectFieldErrors(message)[0]?.field;
  expect(fieldOf('프로젝트명을(를) 입력해 주세요')).toBe('name');
  expect(fieldOf('소속은(는) 100자 이하여야 합니다')).toBe('organization');
  expect(fieldOf('시작일은(는) YYYY-MM-DD 형식의 날짜여야 합니다')).toBe('startDate');
  expect(fieldOf('종료일은 시작일보다 빠를 수 없습니다')).toBe('endDate');
  expect(fieldOf('역할은(는) 100자 이하여야 합니다')).toBe('role');
  expect(fieldOf('요약은(는) 500자 이하여야 합니다')).toBe('summary');
  expect(fieldOf('기여와 성과은(는) 2000자 이하여야 합니다')).toBe('contributions');
  expect(fieldOf('사용 기술에 중복된 항목이 있습니다')).toBe('technologies');
  expect(fieldOf('사용 기술은 30개까지 입력할 수 있습니다')).toBe('technologies');
  expect(fieldOf('저장소 링크에는 공백을 넣을 수 없습니다')).toBe('repositoryUrl');
  expect(fieldOf('서비스 링크은(는) 500자 이하여야 합니다')).toBe('serviceUrl');
  expect(fieldOf('요청 본문은 JSON 객체여야 합니다')).toBeUndefined();
  // More than ten issues end with "외 N개", which stays with the message before it.
  expect(projectFieldErrors('사용 기술 항목은 50자 이하여야 합니다, 외 3개')).toEqual([
    { field: 'technologies', message: '사용 기술 항목은 50자 이하여야 합니다, 외 3개' },
  ]);
});

test('form values become the API input and back', () => {
  expect(splitTechnologies('')).toEqual([]);
  expect(splitTechnologies(' , ,')).toEqual([]);
  expect(splitTechnologies('Go,  Rust ')).toEqual(['Go', 'Rust']);
  expect(toProjectInput({ ...emptyProjectForm, endDate: '' }).endDate).toBeNull();
  expect(toProjectInput(emptyProjectForm).technologies).toEqual([]);
  expect(
    toProjectForm({ ...past, organization: null, endDate: null, technologies: [] }),
  ).toMatchObject({ organization: '', endDate: '', technologies: '', serviceUrl: '' });
});
