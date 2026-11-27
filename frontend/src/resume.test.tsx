import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';

import { App } from './app';

// All data here is made up for the test.

const careers = [
  {
    id: 1,
    company: 'Hanbit Soft',
    department: null,
    position: 'Senior',
    employmentType: 'full_time',
    startDate: '2020-03-02',
    endDate: null,
    duties: 'Built batches',
    achievements: null,
  },
  {
    id: 2,
    company: 'Old Corp',
    department: null,
    position: null,
    employmentType: 'contract',
    startDate: '2017-01-02',
    endDate: '2019-12-31',
    duties: null,
    achievements: null,
  },
];
const projects = [
  {
    id: 7,
    name: 'Settlement',
    organization: null,
    careerId: 1,
    startDate: '2024-05-01',
    endDate: null,
    role: null,
    summary: 'Batch settlement',
    contributions: null,
    skillIds: [3],
    repositoryUrl: null,
    serviceUrl: null,
  },
];
const skills = [
  {
    id: 3,
    name: 'TypeScript',
    category: 'language',
    proficiency: 4,
    memo: null,
    projects: [],
    usedMonths: 0,
  },
];

function serve() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body: Record<string, object> = {
        '/api/health': { today: '2026-11-05' },
        '/api/careers': { careers },
        '/api/projects': { projects },
        '/api/skills': { skills },
        '/api/educations': { educations: [] },
        '/api/certifications': { certifications: [] },
      };
      return Promise.resolve(new Response(JSON.stringify(body[url] ?? {})));
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function openResume() {
  serve();
  window.history.replaceState(null, '', '/resume');
  render(<App />);
  return screen.findByRole('article', { name: 'Resume preview' });
}

test('the preview shows only the items that are checked', async () => {
  const preview = await openResume();
  // Everything starts checked.
  expect(within(preview).getByRole('heading', { name: 'Old Corp' })).toBeInTheDocument();
  expect(
    within(preview).getByText('March 2, 2020 – Present · Senior · Full-time'),
  ).toBeInTheDocument();
  expect(preview).toHaveTextContent('Technologies: TypeScript');

  fireEvent.click(screen.getByRole('checkbox', { name: 'Old Corp' }));
  expect(within(preview).queryByRole('heading', { name: 'Old Corp' })).not.toBeInTheDocument();
  expect(within(preview).getByRole('heading', { name: 'Hanbit Soft' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Select no Projects' }));
  expect(within(preview).queryByRole('region', { name: 'Projects' })).not.toBeInTheDocument();
  expect(within(preview).getByRole('region', { name: 'Career' })).toBeInTheDocument();
});

test('with nothing checked the actions are disabled and the preview says so', async () => {
  await openResume();
  fireEvent.click(screen.getByRole('button', { name: 'Select no Career' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select no Projects' }));
  fireEvent.click(screen.getByRole('button', { name: 'Select no Skills' }));
  expect(screen.getByRole('status')).toHaveTextContent('Nothing is selected yet');
  expect(screen.getByRole('button', { name: 'Download Markdown' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Print or save as PDF' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Select all Career' }));
  expect(screen.getByRole('button', { name: 'Download Markdown' })).toBeEnabled();
});

test('Download Markdown saves resume.md with the chosen items', async () => {
  await openResume();
  let saved: Blob | undefined;
  URL.createObjectURL = vi.fn((blob: Blob) => {
    saved = blob;
    return 'blob:x';
  });
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Old Corp' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download Markdown' }));
  expect(click).toHaveBeenCalledTimes(1);
  const text = await saved?.text();
  expect(text).toContain('### Hanbit Soft');
  expect(text).not.toContain('Old Corp');
});

test('Print writes the page into a new window and opens the print dialog', async () => {
  await openResume();
  const win = { document: { write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);
  fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
  expect(win.document.write).toHaveBeenCalledWith(expect.stringContaining('Hanbit Soft'));
  expect(win.print).toHaveBeenCalled();
});

test('a blocked print window is explained', async () => {
  await openResume();
  vi.spyOn(window, 'open').mockReturnValue(null);
  fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('blocked the print window'),
  );
});

test('the main menu leads to the resume screen', async () => {
  serve();
  window.history.replaceState(null, '', '/');
  render(<App />);
  const menu = screen.getByRole('navigation', { name: 'Main menu' });
  fireEvent.click(within(menu).getByRole('link', { name: 'Resume' }));
  expect(window.location.pathname).toBe('/resume');
  expect(await screen.findByRole('heading', { level: 1, name: 'Resume' })).toBeInTheDocument();
});
