import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';

// Companies and projects here are made up for the test.

const project = (id: number, name: string) => ({
  id,
  name,
  organization: null,
  careerId: null,
  startDate: '2024-05-01',
  endDate: null,
  role: null,
  summary: null,
  contributions: null,
  skillIds: [],
  repositoryUrl: null,
  serviceUrl: null,
});

function serve(saved: number[]) {
  const puts: unknown[] = [];
  let ids = saved;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (data: object, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), { status }));
      if (url === '/api/health') return json({ today: '2026-11-05' });
      if (url === '/api/applications') {
        return json({
          applications: [
            {
              id: 1,
              companyName: '구름데이터',
              position: null,
              postingUrl: null,
              deadline: null,
              status: 'drafting',
              memo: null,
            },
          ],
        });
      }
      if (url === '/api/projects')
        return json({ projects: [project(7, 'Settlement'), project(8, 'Wiki')] });
      if (url === '/api/applications/1/projects') {
        if (init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as { projectIds: number[] };
          puts.push(body);
          ids = body.projectIds;
        }
        return json({ projectIds: ids });
      }
      if (url === '/api/applications/1/questions') return json({ questions: [] });
      if (url === '/api/applications/1/status-history') return json({ history: [] });
      if (url === '/api/applications/1/interviews') return json({ interviews: [] });
      return json({ error: 'API not found' }, 404);
    }),
  );
  return puts;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('the application page checks its saved projects and saves a new choice', async () => {
  const puts = serve([7]);
  window.history.replaceState(null, '', '/applications/1');
  render(<App />);
  const settlement = await screen.findByRole('checkbox', { name: 'Settlement' });
  const wiki = screen.getByRole('checkbox', { name: 'Wiki' });
  await waitFor(() => expect(settlement).toBeChecked());
  expect(wiki).not.toBeChecked();
  const save = screen.getByRole('button', { name: 'Save highlighted projects' });
  // Nothing changed yet, so there is nothing to save.
  expect(save).toBeDisabled();

  await userEvent.click(wiki);
  await userEvent.click(settlement);
  expect(save).toBeEnabled();
  await userEvent.click(save);
  await waitFor(() => expect(puts).toEqual([{ projectIds: [8] }]));
  await waitFor(() => expect(save).toBeDisabled());
  expect(screen.getByRole('checkbox', { name: 'Wiki' })).toBeChecked();
});
