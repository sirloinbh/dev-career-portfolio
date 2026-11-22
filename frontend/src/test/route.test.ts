import { expect, test } from 'vitest';

import { parseRequest, unexpectedRequest } from './route';

test('reads the method, the path without the query, and the numeric id', () => {
  expect(parseRequest('/api/educations/3?x=1', { method: 'put' })).toEqual({
    method: 'PUT',
    path: '/api/educations/3',
    id: 3,
  });
  expect(parseRequest('/api/educations')).toEqual({
    method: 'GET',
    path: '/api/educations',
    id: null,
  });
});

test('an unknown request fails with a message that names it', () => {
  expect(() => unexpectedRequest(parseRequest('/api/nope/9', { method: 'DELETE' }))).toThrow(
    'Unexpected request in the test fake: DELETE /api/nope/9',
  );
});
