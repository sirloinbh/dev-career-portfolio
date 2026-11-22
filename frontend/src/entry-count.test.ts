import { expect, test } from 'vitest';

import { entryCount } from './entry-count';

test('entryCount uses the singular only for one', () => {
  expect(entryCount(0)).toBe('0 entries');
  expect(entryCount(1)).toBe('1 entry');
  expect(entryCount(2)).toBe('2 entries');
});
