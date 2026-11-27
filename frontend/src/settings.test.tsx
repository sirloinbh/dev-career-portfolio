import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';
import { summarizeExport } from './settings-data';
import { findLive } from './test/live';
import { parseRequest, unexpectedRequest } from './test/route';

// All records here are made up for the test.

const exportFile = {
  format: 'dev-career-portfolio-export',
  version: 1,
  exportedAt: '2026-11-27T01:02:03.000Z',
  tables: {
    skills: [{ id: 1, name: 'TypeScript' }],
    educations: [{ id: 1, school: '한국대학교' }],
    certifications: [],
  },
};

type Handlers = { importResult?: { status: number; body: object } };

function serve({ importResult = { status: 200, body: { imported: {} } } }: Handlers = {}) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const request = parseRequest(input, init);
      calls.push({
        method: request.method,
        path: request.path,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      });
      if (request.path === '/api/health') {
        return Promise.resolve(new Response(JSON.stringify({ today: '2026-11-27' })));
      }
      if (request.method === 'GET' && request.path === '/api/data/export') {
        return Promise.resolve(new Response(JSON.stringify(exportFile)));
      }
      if (request.method === 'POST' && request.path === '/api/data/import') {
        return Promise.resolve(
          new Response(JSON.stringify(importResult.body), { status: importResult.status }),
        );
      }
      return unexpectedRequest(request);
    }),
  );
  window.history.replaceState(null, '', '/settings');
  render(<App />);
  return calls;
}

const fileOf = (content: string, name = 'backup.json') =>
  new File([content], name, { type: 'application/json' });

afterEach(() => vi.unstubAllGlobals());

test('the Settings page offers export and import', async () => {
  serve();
  expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Export all data' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Import from a file' })).toBeInTheDocument();
});

test('Export downloads the JSON file and says how much it saved', async () => {
  const calls = serve();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const create = vi.fn(() => 'blob:export');
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
  fireEvent.click(await screen.findByRole('button', { name: 'Export data' }));
  expect(
    await screen.findByText(/Saved 2 records to dev-career-portfolio-\d{4}-\d{2}-\d{2}\.json/),
  ).toBeInTheDocument();
  expect(calls.some((call) => call.path === '/api/data/export')).toBe(true);
  expect(click).toHaveBeenCalledOnce();
  const blob = (create.mock.calls[0] as unknown as [Blob])[0];
  expect(JSON.parse(await blob.text())).toEqual(exportFile);
  click.mockRestore();
});

test('Import asks for confirmation, then replaces the data', async () => {
  const user = userEvent.setup();
  const calls = serve();
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  await user.upload(
    screen.getByLabelText('Export file (.json)'),
    fileOf(JSON.stringify(exportFile)),
  );
  expect(
    await screen.findByText(/backup\.json: 2 records, exported 2026-11-27/),
  ).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Import data…' }));
  const dialog = await screen.findByRole('dialog');
  expect(
    within(dialog).getByText(/will be deleted and replaced by the 2 records in backup\.json/),
  ).toBeInTheDocument();
  // Nothing is sent before the confirmation.
  expect(calls.some((call) => call.path === '/api/data/import')).toBe(false);

  await user.click(within(dialog).getByRole('button', { name: 'Replace all data' }));
  await waitFor(() => expect(calls.some((call) => call.path === '/api/data/import')).toBe(true));
  expect(calls.find((call) => call.path === '/api/data/import')?.body).toEqual(exportFile);
  expect(await screen.findByText('Imported 2 records from backup.json')).toBeInTheDocument();
});

test('Cancelling the confirmation sends nothing', async () => {
  const user = userEvent.setup();
  const calls = serve();
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  await user.upload(
    screen.getByLabelText('Export file (.json)'),
    fileOf(JSON.stringify(exportFile)),
  );
  await user.click(await screen.findByRole('button', { name: 'Import data…' }));
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
  );
  expect(calls.some((call) => call.path === '/api/data/import')).toBe(false);
});

test('a file that is not JSON or not an export is refused before anything is sent', async () => {
  const user = userEvent.setup();
  const calls = serve();
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  const input = screen.getByLabelText('Export file (.json)');
  await user.upload(input, fileOf('{broken'));
  expect(await findLive('alert')).toHaveTextContent('not valid JSON');
  await user.upload(input, fileOf(JSON.stringify({ hello: 'world' }), 'other.json'));
  expect(await screen.findByText(/not a Dev Career Portfolio export/)).toBeInTheDocument();
  // Without a valid file the Import button opens nothing.
  await user.click(screen.getByRole('button', { name: 'Import data…' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(calls.some((call) => call.path === '/api/data/import')).toBe(false);
});

test('a refusal from the server is shown and the file stays selected', async () => {
  const user = userEvent.setup();
  serve({
    importResult: {
      status: 400,
      body: { error: 'Unsupported export version: this app reads version 1' },
    },
  });
  await screen.findByRole('heading', { level: 1, name: 'Settings' });
  await user.upload(
    screen.getByLabelText('Export file (.json)'),
    fileOf(JSON.stringify(exportFile)),
  );
  await user.click(await screen.findByRole('button', { name: 'Import data…' }));
  await user.click(
    within(await screen.findByRole('dialog')).getByRole('button', {
      name: 'Replace all data',
    }),
  );
  expect(await findLive('alert')).toHaveTextContent('Unsupported export version');
  expect(screen.getByText(/backup\.json: 2 records/)).toBeInTheDocument();
});

test('summarizeExport reads the counts and rejects other shapes', () => {
  expect(summarizeExport(exportFile)).toEqual({
    exportedAt: '2026-11-27T01:02:03.000Z',
    counts: [
      ['skills', 1],
      ['educations', 1],
      ['certifications', 0],
    ],
    total: 2,
  });
  expect(summarizeExport(null)).toBeNull();
  expect(summarizeExport({ ...exportFile, format: 'x' })).toBeNull();
  expect(summarizeExport({ ...exportFile, tables: { skills: {} } })).toBeNull();
});
