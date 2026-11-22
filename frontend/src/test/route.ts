// Helpers for the fake APIs in screen tests (#148): a fake answers by method and path, and a request
// it does not know fails the test with a clear message instead of getting some default body.

export type FakeRequest = {
  method: string;
  /** The path without the host or query, such as `/api/educations/3`. */
  path: string;
  /** The numeric id after `/api/<collection>/`, or null for the collection itself. */
  id: number | null;
};

/** Reads the method and path of a fetch call. */
export function parseRequest(input: RequestInfo | URL, init?: RequestInit): FakeRequest {
  const { pathname } = new URL(String(input), 'http://localhost');
  const id = /^\/api\/[^/]+\/(\d+)$/.exec(pathname)?.[1];
  return {
    method: (init?.method ?? 'GET').toUpperCase(),
    path: pathname,
    id: id ? Number(id) : null,
  };
}

/** The error a fake throws for a request it has no answer for. */
export function unexpectedRequest({ method, path }: FakeRequest): never {
  throw new Error(`Unexpected request in the test fake: ${method} ${path}`);
}
