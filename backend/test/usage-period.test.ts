import assert from 'node:assert/strict';
import { test } from 'node:test';

import { usedMonths } from '../src/usage-period.js';

const today = '2026-11-27';
const span = (startDate: string, endDate: string | null) => ({ startDate, endDate });

test('no projects means no months', () => {
  assert.equal(usedMonths([], today), 0);
});

test('one project counts whole months, both end days included, and drops a partial month', () => {
  assert.equal(usedMonths([span('2020-01-01', '2020-12-31')], today), 12);
  assert.equal(usedMonths([span('2020-01-15', '2020-03-13')], today), 1);
});

test('overlapping projects count the shared time once', () => {
  assert.equal(
    usedMonths([span('2020-01-01', '2020-12-31'), span('2020-07-01', '2021-06-30')], today),
    18,
  );
  assert.equal(
    usedMonths([span('2020-01-01', '2021-12-31'), span('2020-05-01', '2020-08-31')], today),
    24,
  );
});

test('back-to-back projects join, and a gap is not counted', () => {
  assert.equal(
    usedMonths([span('2020-01-01', '2020-06-30'), span('2020-07-01', '2020-12-31')], today),
    12,
  );
  assert.equal(
    usedMonths([span('2020-01-01', '2020-06-30'), span('2021-01-01', '2021-06-30')], today),
    12,
  );
});

test('an open-ended project counts up to today, and nothing counts after today', () => {
  assert.equal(usedMonths([span('2026-01-01', null)], today), 10);
  assert.equal(
    usedMonths([span('2020-01-01', '2020-06-30'), span('2026-06-01', null)], today),
    6 + 5,
  );
  assert.equal(usedMonths([span('2026-01-01', '2027-12-31')], today), 10);
  assert.equal(usedMonths([span('2027-01-01', null)], today), 0);
});
