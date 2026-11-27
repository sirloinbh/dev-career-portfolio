import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';

import type { Attachment } from './attachment-data';
import { formatSize } from './attachment-data';
import { AttachmentSection } from './attachment-section';
import { TestQueryProvider } from './test/query';

// File names here are made up for the test.

afterEach(() => {
  vi.unstubAllGlobals();
});

const scan: Attachment = {
  id: 7,
  filename: '합격증.pdf',
  contentType: 'application/pdf',
  sizeBytes: 2048,
  createdAt: '2026-11-27T00:00:00Z',
};

/** A fake API holding the files of certification 1; an upload answers with `uploadStatus`. */
function serve(initial: Attachment[], uploadStatus = 201, uploadError = '') {
  let files = [...initial];
  const calls: { method: string; url: string; body?: BodyInit | null }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, url, body: init?.body });
      const json = (data: object, status = 200) =>
        Promise.resolve(new Response(JSON.stringify(data), { status }));
      if (url === '/api/certifications/1/attachments') {
        if (method === 'POST') {
          if (uploadStatus !== 201) return json({ error: uploadError }, uploadStatus);
          const file = (init?.body as FormData).get('file') as File;
          const created = { ...scan, id: 8, filename: file.name, sizeBytes: file.size };
          files.push(created);
          return json({ attachment: created }, 201);
        }
        return json({ attachments: files });
      }
      if (method === 'DELETE' && url === '/api/attachments/7') {
        files = files.filter((file) => file.id !== 7);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return json({ error: 'unexpected' }, 500);
    }),
  );
  return calls;
}

const renderSection = () =>
  render(
    <TestQueryProvider>
      <AttachmentSection owner="certifications" id="1" />
    </TestQueryProvider>,
  );

test('sizes read as B, KB or MB', () => {
  expect(formatSize(12)).toBe('12 B');
  expect(formatSize(2048)).toBe('2 KB');
  expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
});

test('files are listed with a download link, and an empty list says so', async () => {
  serve([scan]);
  renderSection();
  const list = await screen.findByRole('list', { name: 'Attached files' });
  expect(within(list).getByText('합격증.pdf')).toBeInTheDocument();
  expect(within(list).getByRole('link', { name: 'Download 합격증.pdf' })).toHaveAttribute(
    'href',
    '/api/attachments/7',
  );
});

test('a chosen file is uploaded and shows in the list', async () => {
  const calls = serve([]);
  renderSection();
  expect(await screen.findByText('No files attached yet.')).toBeInTheDocument();
  const user = userEvent.setup();
  await user.upload(
    screen.getByLabelText('Choose a file to attach'),
    new File(['%PDF-1.7'], 'new.pdf', { type: 'application/pdf' }),
  );
  expect(await screen.findByText('new.pdf')).toBeInTheDocument();
  expect(calls.some((call) => call.method === 'POST')).toBe(true);
});

test('a file over 5 MB is refused in the browser without a request', async () => {
  const calls = serve([]);
  renderSection();
  await screen.findByText('No files attached yet.');
  const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.pdf', {
    type: 'application/pdf',
  });
  await userEvent.setup().upload(screen.getByLabelText('Choose a file to attach'), big);
  expect(await screen.findByText('File must be at most 5 MB')).toBeInTheDocument();
  expect(calls.some((call) => call.method === 'POST')).toBe(false);
});

test("the server's refusal is shown", async () => {
  serve([], 400, 'File must be a PDF, PNG or JPEG');
  renderSection();
  await screen.findByText('No files attached yet.');
  await userEvent
    .setup()
    .upload(
      screen.getByLabelText('Choose a file to attach'),
      new File(['x'], 'a.png', { type: 'image/png' }),
    );
  expect(await screen.findByText('File must be a PDF, PNG or JPEG')).toBeInTheDocument();
});

test('a file is deleted after a confirmation', async () => {
  const calls = serve([scan]);
  renderSection();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Delete 합격증.pdf' }));
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('No files attached yet.')).toBeInTheDocument();
  await waitFor(() => {
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true);
  });
});
