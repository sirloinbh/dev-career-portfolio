import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';

// Names here are made up for the test.

type Link = {
  id: number;
  label: string;
  counts: Record<string, number>;
  createdAt: string;
  revokedAt: string | null;
};

function serve(links: Link[]) {
  const posts: { url: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (data: object, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), { status }));
      if (url === '/api/health') return json({ today: '2026-11-05' });
      if (url === '/api/projects')
        return json({
          projects: [
            { id: 7, name: 'Settlement', startDate: '2024-05-01', endDate: null, skillIds: [] },
          ],
        });
      if (url === '/api/careers' || url === '/api/educations' || url === '/api/certifications')
        return json({ [url.slice(5)]: [] });
      if (url === '/api/share-links' && init?.method === 'POST') {
        posts.push({ url, body: JSON.parse(String(init.body)) });
        return json({ shareLink: links[0], token: 'T'.repeat(43) }, 201);
      }
      if (url === '/api/share-links/1/revoke') {
        posts.push({ url, body: null });
        const link = links[0];
        if (link) link.revokedAt = '2026-11-06T00:00:00Z';
        return json({ shareLink: link });
      }
      if (url === '/api/share-links') return json({ shareLinks: links });
      if (url === `/api/share/${'T'.repeat(43)}`)
        return json({
          label: 'For Acme',
          careers: [],
          projects: [
            {
              id: 7,
              name: 'Settlement',
              organization: null,
              startDate: '2024-05-01',
              endDate: null,
              role: 'Backend',
              summary: 'Payments',
              contributions: null,
              repositoryUrl: null,
              serviceUrl: null,
              skills: ['TypeScript'],
            },
          ],
          educations: [],
          certifications: [],
        });
      if (url.startsWith('/api/share/')) return json({ error: 'Share link not found' }, 404);
      return json({ error: 'unexpected ' + url }, 500);
    }),
  );
  return posts;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

const link = (over: Partial<Link> = {}): Link => ({
  id: 1,
  label: 'For Acme',
  counts: { careers: 0, projects: 1, educations: 0, certifications: 0 },
  createdAt: '2026-11-05T09:00:00Z',
  revokedAt: null,
  ...over,
});

test('creating a link sends the chosen items and shows the link once', async () => {
  const posts = serve([link()]);
  window.history.pushState({}, '', '/share');
  render(<App />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText(/Name of the link/), 'For Acme');
  await user.click(await screen.findByRole('checkbox', { name: 'Settlement' }));
  await user.click(screen.getByRole('button', { name: 'Create link' }));
  await waitFor(() =>
    expect(posts[0]?.body).toEqual({
      label: 'For Acme',
      careers: [],
      projects: [7],
      educations: [],
      certifications: [],
    }),
  );
  const shown = await screen.findByLabelText<HTMLInputElement>('Share link');
  expect(shown.value).toBe(`${window.location.origin}/share/${'T'.repeat(43)}`);
});

test('a link can be turned off', async () => {
  const posts = serve([link()]);
  window.history.pushState({}, '', '/share');
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Turn off For Acme' }));
  await waitFor(() => expect(posts.some((p) => p.url === '/api/share-links/1/revoke')).toBe(true));
  expect(await screen.findByText(/Turned off/)).toBeTruthy();
});

test('the public page shows the shared items without the sign-in or the app menu', async () => {
  serve([]);
  window.history.pushState({}, '', `/share/${'T'.repeat(43)}`);
  render(<App />);
  const main = await screen.findByRole('main');
  expect(await within(main).findByRole('heading', { name: 'For Acme' })).toBeTruthy();
  expect(within(main).getByText('Settlement')).toBeTruthy();
  expect(screen.queryByRole('navigation')).toBeNull();
});

test('a wrong or turned-off link says so', async () => {
  serve([]);
  window.history.pushState({}, '', `/share/${'x'.repeat(43)}`);
  render(<App />);
  expect(await screen.findByText('This link does not work')).toBeTruthy();
});
