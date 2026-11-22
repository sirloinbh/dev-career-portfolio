import { expect, test } from 'vitest';

import { webLink } from './web-link';

test('keeps http(s) links, in any letter case', () => {
  expect(webLink('http://example.com')).toBe('http://example.com');
  expect(webLink('HTTPS://example.com')).toBe('HTTPS://example.com');
});

test('returns null for null, an empty string and other schemes', () => {
  expect(webLink(null)).toBeNull();
  expect(webLink('')).toBeNull();
  expect(webLink('javascript:alert(1)')).toBeNull();
});
