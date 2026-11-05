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
 * answers the next POST or PUT with that status and Korean message, as the server would.
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
      if (index === -1) return json({ error: '스킬을 찾을 수 없습니다' }, 404);
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
  fireEvent.click(await screen.findByRole('link', { name: '스킬 추가' }));
  expect(await screen.findByRole('heading', { level: 1, name: '스킬 추가' })).toBeInTheDocument();

  fireEvent.change(field('스킬명'), { target: { value: 'PostgreSQL' } });
  fireEvent.change(field('분류'), { target: { value: 'database' } });
  fireEvent.click(level(/^4점 · 숙련/));
  fireEvent.click(screen.getByRole('button', { name: '추가' }));

  expect(await screen.findByRole('heading', { level: 1, name: '스킬' })).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({
    name: 'PostgreSQL',
    category: 'database',
    proficiency: 4,
    memo: '',
  });
  expect(
    await screen.findByRole('heading', { level: 2, name: '데이터베이스 1건' }),
  ).toBeInTheDocument();
  const item = screen.getByRole('listitem', { name: 'PostgreSQL' });
  expect(within(item).getByText('숙련도 5점 중 4점, 숙련')).toBeInTheDocument();
  expect(await screen.findByText("'PostgreSQL' 스킬을 추가했습니다")).toBeInTheDocument();
});

test('the five steps each say what they mean, and none is chosen for a new skill', async () => {
  fakeApi([]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: '스킬 추가' });
  const group = screen.getByRole('group', { name: '숙련도' });
  expect(group).toHaveAccessibleDescription('지금 할 수 있는 일에 가장 가까운 단계를 고릅니다.');
  const radios = within(group).getAllByRole('radio');
  expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['1', '2', '3', '4', '5']);
  expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
  for (const step of proficiencyLevels) {
    expect(
      within(group).getByRole('radio', { name: `${step.value}점 · ${step.name}${step.criterion}` }),
    ).toBeInTheDocument();
  }
});

test('no proficiency chosen: the server message is tied to the steps and focus goes to the first', async () => {
  const api = fakeApi([]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: '스킬 추가' });
  fireEvent.change(field('스킬명'), { target: { value: 'Rust' } });
  api.refuseNext(400, '숙련도는 1~5 사이의 정수여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(level(/^1점/)).toHaveFocus());
  expect(api.calls.find((call) => call.method === 'POST')?.body).toMatchObject({
    proficiency: null,
  });
  expect(screen.getByRole('group', { name: '숙련도' })).toHaveAccessibleDescription(
    expect.stringContaining('숙련도는 1~5 사이의 정수여야 합니다'),
  );
  expect(field('스킬명')).toHaveValue('Rust');
});

test('a taken name (409) is shown under the name field, not as a general error', async () => {
  const api = fakeApi([go]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: '스킬 추가' });
  fireEvent.change(field('스킬명'), { target: { value: 'go' } });
  fireEvent.click(level(/^2점/));
  api.refuseNext(409, '이미 등록된 스킬입니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  await waitFor(() => expect(field('스킬명')).toHaveFocus());
  expect(field('스킬명')).toHaveAttribute('aria-invalid', 'true');
  expect(field('스킬명')).toHaveAccessibleDescription('이미 등록된 스킬입니다');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a message that names no field is shown below the form and focus returns to the button', async () => {
  const api = fakeApi([]);
  open('/skills/new');
  await screen.findByRole('heading', { level: 1, name: '스킬 추가' });
  api.refuseNext(400, '요청 본문은 JSON 객체여야 합니다');
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('요청 본문은 JSON 객체여야 합니다');
  await waitFor(() => expect(screen.getByRole('button', { name: '추가' })).toHaveFocus());
});

test('a skill is edited with its saved values filled in', async () => {
  const api = fakeApi([go]);
  open('/skills');
  fireEvent.click(await screen.findByRole('link', { name: 'Go 수정' }));
  expect(await screen.findByRole('heading', { level: 1, name: '스킬 수정' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/skills/1/edit');
  expect(field('스킬명')).toHaveValue('Go');
  expect(field('분류')).toHaveValue('language');
  expect(level(/^3점/)).toBeChecked();

  fireEvent.click(level(/^5점/));
  fireEvent.change(field('메모'), { target: { value: '사이드 프로젝트 2개' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
  expect(await screen.findByRole('heading', { level: 1, name: '스킬' })).toBeInTheDocument();
  const put = api.calls.find((call) => call.method === 'PUT');
  expect(put?.url).toBe('/api/skills/1');
  expect(put?.body).toEqual({
    name: 'Go',
    category: 'language',
    proficiency: 5,
    memo: '사이드 프로젝트 2개',
  });
  const item = await screen.findByRole('listitem', { name: 'Go' });
  expect(within(item).getByText('숙련도 5점 중 5점, 전문')).toBeInTheDocument();
  expect(item).toHaveTextContent('사이드 프로젝트 2개');
});

test('editing a skill that no longer exists says so', async () => {
  fakeApi([]);
  open('/skills/9/edit');
  expect(await screen.findByRole('alert')).toHaveTextContent('스킬을 찾을 수 없습니다');
});

test('cancelling the delete dialog keeps the skill', async () => {
  const api = fakeApi([go]);
  open('/skills');
  fireEvent.click(await screen.findByRole('button', { name: 'Go 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '스킬을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.calls.some((call) => call.method === 'DELETE')).toBe(false);
  expect(api.store).toHaveLength(1);
  expect(screen.getByRole('listitem', { name: 'Go' })).toBeInTheDocument();
});

test('confirming the delete removes the skill and moves focus to the page title', async () => {
  const api = fakeApi([go]);
  open('/skills');
  fireEvent.click(await screen.findByRole('button', { name: 'Go 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '스킬을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByRole('heading', { name: '아직 등록한 스킬이 없습니다' }),
  ).toBeInTheDocument();
  expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/skills/1');
  expect(api.store).toHaveLength(0);
  expect(await screen.findByText("'Go' 스킬을 지웠습니다")).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('heading', { level: 1, name: '스킬' })).toHaveFocus(),
  );
});

test('a failed delete keeps the dialog open and the row on screen', async () => {
  const api = fakeApi([go]);
  api.failDeletes(503, '데이터베이스에 연결할 수 없습니다');
  open('/skills');
  fireEvent.click(await screen.findByRole('button', { name: 'Go 삭제' }));
  const dialog = await screen.findByRole('dialog', { name: '스킬을 지울까요?' });
  fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }));
  expect(
    await screen.findByText('스킬을 지우지 못했습니다. 데이터베이스에 연결할 수 없습니다'),
  ).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: '스킬을 지울까요?' })).toBeInTheDocument();
});

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => skillFieldErrors(message)[0]?.field;
  expect(fieldOf('스킬명을(를) 입력해 주세요')).toBe('name');
  expect(fieldOf('스킬명은(는) 50자 이하여야 합니다')).toBe('name');
  expect(fieldOf('이미 등록된 스킬입니다')).toBe('name');
  expect(fieldOf('숙련도는 1~5 사이의 정수여야 합니다')).toBe('proficiency');
  expect(fieldOf('메모은(는) 2000자 이하여야 합니다')).toBe('memo');
  expect(fieldOf('요청 본문은 JSON 객체여야 합니다')).toBeUndefined();
  // The category message holds commas of its own; it stays one message.
  expect(
    skillFieldErrors(
      '분류는 언어, 프레임워크·라이브러리, 데이터베이스, 인프라·클라우드, 도구, 기타 중 하나여야 합니다',
    ),
  ).toHaveLength(1);
});

test('form values become the API input and back', () => {
  expect(toSkillInput(emptySkillForm).proficiency).toBeNull();
  expect(toSkillInput({ ...emptySkillForm, proficiency: '4' }).proficiency).toBe(4);
  expect(toSkillForm(go)).toEqual({ name: 'Go', category: 'language', proficiency: '3', memo: '' });
});
