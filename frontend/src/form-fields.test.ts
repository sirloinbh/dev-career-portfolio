import { expect, test } from 'vitest';

import { toNumber } from './form-fields';

test('an empty or blank number field is "not entered"', () => {
  expect(toNumber('')).toBeNull();
  expect(toNumber('   ')).toBeNull();
});

test('plain decimals become numbers, with surrounding spaces ignored', () => {
  expect(toNumber('0')).toBe(0);
  expect(toNumber('42')).toBe(42);
  expect(toNumber(' 3.5 ')).toBe(3.5);
  expect(toNumber('-2')).toBe(-2);
  expect(toNumber('+7')).toBe(7);
  expect(toNumber('.5')).toBe(0.5);
  expect(toNumber('5.')).toBe(5);
});

test('text that Number() would read but is not a plain decimal goes as typed', () => {
  // JSON sends Infinity as null, and 0x4 and 1e1 are not what a person means by a number.
  expect(toNumber('Infinity')).toBe('Infinity');
  expect(toNumber('0x4')).toBe('0x4');
  expect(toNumber('1e1')).toBe('1e1');
  expect(toNumber('+5.')).toBe(5);
  expect(toNumber('abc')).toBe('abc');
  expect(toNumber('1,000')).toBe('1,000');
});

test('a decimal too large for a finite number goes as typed', () => {
  const huge = '9'.repeat(400);
  expect(toNumber(huge)).toBe(huge);
});
