import { expect, test } from 'vitest';

import { daysUntil } from './service-date';

test('daysUntil counts whole days, negative once passed', () => {
  expect(daysUntil('2026-11-05', '2026-11-05')).toBe(0);
  expect(daysUntil('2026-11-10', '2026-11-05')).toBe(5);
  expect(daysUntil('2026-11-01', '2026-11-05')).toBe(-4);
  // Across a month end and across a leap day.
  expect(daysUntil('2026-12-01', '2026-11-30')).toBe(1);
  expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2);
});
test('daysUntil counts whole days, negative once passed', () => {
  expect(daysUntil('2026-11-05', '2026-11-05')).toBe(0);
  expect(daysUntil('2026-11-10', '2026-11-05')).toBe(5);
  expect(daysUntil('2026-11-01', '2026-11-05')).toBe(-4);
  // Across a month end and across a leap day.
  expect(daysUntil('2026-12-01', '2026-11-30')).toBe(1);
  expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2);
});
