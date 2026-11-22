import { vi } from 'vitest';

import { parseRequest, unexpectedRequest } from './route';

// A fake API for one list (#152), for screens rendered with TestQueryProvider (test/query.tsx).

/**
 * Answers `GET path` with `{ [key]: rows }` from `load`, called once per request. When `load` rejects, the answer is a
 * 503 whose `error` is the rejection's message. Any other request fails the test.
 */
export function serveList<Row>(path: string, key: string, load: () => Promise<Row[]>) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = parseRequest(input, init);
    if (request.method !== 'GET' || request.path !== path) unexpectedRequest(request);
    try {
      return new Response(JSON.stringify({ [key]: await load() }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Server error';
      return new Response(JSON.stringify({ error: message }), { status: 503 });
    }
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
