import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { App } from './app';
import { findLive } from './test/live';

const health = (body: object, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status }))),
  );

test('shows the server date from /api/health on the overview', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(await screen.findByText('Server connected · 2026-10-26')).toBeInTheDocument();
});

test('reports a server error as an alert', async () => {
  health({ error: 'Cannot connect to the database' }, 503);
  render(<App />);
  expect(await findLive('alert')).toHaveTextContent('Cannot connect to the database');
});

test('each page has its own address and is marked in the main menu', async () => {
  health({ today: '2026-10-26' });
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Settings' }));
  expect(window.location.pathname).toBe('/settings');
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  expect(within(menu).getByRole('link', { name: 'Settings' })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('an unknown address falls back to the overview', async () => {
  health({ today: '2026-10-26' });
  window.history.replaceState(null, '', '/no-such-page');
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/');
});

// The sign-in gate only exists on a host under the root domain. jsdom's host is localhost, so these
// tests stub the location (and the session check at /api/me) the way a deployed page sees them.
function deployedPage(me: () => Response) {
  const assign = vi.fn();
  vi.stubGlobal('location', {
    protocol: 'https:',
    hostname: 'career.daysofme.com',
    host: 'career.daysofme.com',
    origin: 'https://career.daysofme.com',
    href: 'https://career.daysofme.com/',
    pathname: '/',
    search: '',
    hash: '',
    assign,
    reload: vi.fn(),
  });
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const path = new URL(String(input), 'https://career.daysofme.com').pathname;
      if (path === '/api/me') return Promise.resolve(me());
      if (path === '/api/health')
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-10-26' })));
      throw new Error(`Unexpected request to ${path}`);
    }),
  );
  return assign;
}

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status });

test('a signed-out visitor sees the checking state, then is sent to sign-in', async () => {
  const assign = deployedPage(() => json({ error: 'unauthorized' }, 401));
  render(<App />);
  expect(screen.getByText('Checking your sign-in…')).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument();
  await vi.waitFor(() =>
    expect(assign).toHaveBeenCalledWith(
      `https://auth.daysofme.com/sign-in?returnTo=${encodeURIComponent('https://career.daysofme.com/')}`,
    ),
  );
  expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument();
});

test('a signed-in visitor gets the app with the account name and a sign-out link', async () => {
  deployedPage(() => json({ user: { id: 'u1', email: 'me@example.com', name: 'Demo Person' } }));
  render(<App />);
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  expect(screen.getByText('Demo Person')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign out' })).toHaveAttribute(
    'href',
    `https://auth.daysofme.com/sign-out?returnTo=${encodeURIComponent('https://career.daysofme.com')}`,
  );
});

test('a failed session check shows a retry instead of the app', async () => {
  deployedPage(() => json({ error: 'down' }, 500));
  render(<App />);
  expect(await findLive('alert')).toHaveTextContent('Could not check your sign-in.');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Main menu' })).not.toBeInTheDocument();
});
