import { expect, test } from 'vitest';

import { knownValues } from './list-query';

test('known values are distinct, most used first, and ignore blanks, spaces and case', () => {
  const rows = [
    { v: 'Seoul Univ' },
    { v: ' seoul univ ' },
    { v: 'KAIST' },
    { v: null },
    { v: '' },
    { v: 'Yonsei' },
    { v: 'Yonsei' },
    { v: 'Yonsei' },
  ];
  expect(knownValues(rows, (r) => r.v)).toEqual(['Yonsei', 'Seoul Univ', 'KAIST']);
});
