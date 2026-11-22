import { expect, test } from 'vitest';

import { daysUntil, formatDate, serviceToday } from './service-date';

test('formatDate writes a valid date in English', () => {
  expect(formatDate('2026-10-22')).toBe('October 22, 2026');
});

test('formatDate returns the raw text for an invalid date instead of throwing', () => {
  expect(formatDate('bad')).toBe('bad');
  expect(formatDate('')).toBe('');
});

test('serviceToday follows Asia/Seoul, not UTC', () => {
  // 15:00 UTC is already midnight of the next day in Seoul (UTC+9); 14:59 is not.
  expect(serviceToday(new Date('2026-11-05T14:59:00Z'))).toBe('2026-11-05');
  expect(serviceToday(new Date('2026-11-05T15:00:00Z'))).toBe('2026-11-06');
});

test('daysUntil counts whole days, negative once passed', () => {
  expect(daysUntil('2026-11-05', '2026-11-05')).toBe(0);
  expect(daysUntil('2026-11-10', '2026-11-05')).toBe(5);
  expect(daysUntil('2026-11-01', '2026-11-05')).toBe(-4);
  // Across a month end and across a leap day.
  expect(daysUntil('2026-12-01', '2026-11-30')).toBe(1);
  expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2);
});
