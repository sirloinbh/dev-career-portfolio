import { expect, test } from 'vitest';

import { formatDate } from './service-date';

test('formatDate writes a valid date in English', () => {
  expect(formatDate('2026-10-22')).toBe('October 22, 2026');
});

test('formatDate returns the raw text for an invalid date instead of throwing', () => {
  expect(formatDate('bad')).toBe('bad');
  expect(formatDate('')).toBe('');
});
