import { expect, test } from 'vitest';

// Screen text is English only (#246). This scans the app sources, not the tests.
const sources = import.meta.glob<string>(['./**/*.{ts,tsx,css}', '!./**/*.test.{ts,tsx}'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

test('no source file under frontend/src contains Korean text', () => {
  const withKorean = Object.entries(sources)
    .filter(([, text]) => /[\uAC00-\uD7A3]/.test(text))
    .map(([file]) => file);
  expect(Object.keys(sources).length).toBeGreaterThan(20);
  expect(withKorean).toEqual([]);
});
