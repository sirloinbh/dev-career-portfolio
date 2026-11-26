import { expect, test } from 'vitest';

import { experienceOf, monthsText } from './experience';

const job = (startDate: string, endDate: string | null, employmentType = 'full_time') => ({
  startDate,
  endDate,
  employmentType,
});
const today = '2026-11-27';

test('a single job counts whole months, both end days included', () => {
  expect(experienceOf([job('2020-01-01', '2020-12-31')], today).workMonths).toBe(12);
  expect(experienceOf([job('2020-01-15', '2020-03-14')], today).workMonths).toBe(2);
});

test('a partial month is rounded down', () => {
  expect(experienceOf([job('2020-01-15', '2020-03-13')], today).workMonths).toBe(1);
  expect(experienceOf([job('2020-01-01', '2020-01-30')], today).workMonths).toBe(0);
});

test('overlapping jobs count the shared time once', () => {
  const jobs = [job('2020-01-01', '2020-12-31'), job('2020-07-01', '2021-06-30')];
  expect(experienceOf(jobs, today).workMonths).toBe(18);
});

test('a job inside another job adds nothing', () => {
  const jobs = [job('2020-01-01', '2021-12-31'), job('2020-05-01', '2020-08-31')];
  expect(experienceOf(jobs, today).workMonths).toBe(24);
});

test('back-to-back jobs join without losing a month', () => {
  const jobs = [job('2020-01-01', '2020-06-30'), job('2020-07-01', '2020-12-31')];
  expect(experienceOf(jobs, today).workMonths).toBe(12);
});

test('a gap between jobs is not counted', () => {
  const jobs = [job('2020-01-01', '2020-06-30'), job('2021-01-01', '2021-06-30')];
  expect(experienceOf(jobs, today).workMonths).toBe(12);
});

test('a current job counts up to today in the service time zone', () => {
  expect(experienceOf([job('2026-01-01', null)], today).workMonths).toBe(10);
  expect(experienceOf([job('2026-11-01', null)], today).workMonths).toBe(0);
});

test('nothing counts after today', () => {
  expect(experienceOf([job('2026-01-01', '2027-12-31')], today).workMonths).toBe(10);
  expect(experienceOf([job('2027-01-01', null)], today)).toEqual({
    workMonths: 0,
    internMonths: 0,
  });
});

test('internships are kept out of the total and counted on their own', () => {
  const jobs = [
    job('2019-07-01', '2019-12-31', 'intern'),
    job('2020-01-01', '2020-12-31'),
    job('2019-09-01', '2020-02-29', 'intern'),
  ];
  expect(experienceOf(jobs, today)).toEqual({ workMonths: 12, internMonths: 8 });
});

test('no careers gives zero', () => {
  expect(experienceOf([], today)).toEqual({ workMonths: 0, internMonths: 0 });
});

test('months are written as years and months', () => {
  expect(monthsText(0)).toBe('0 months');
  expect(monthsText(1)).toBe('1 month');
  expect(monthsText(12)).toBe('1 year');
  expect(monthsText(13)).toBe('1 year 1 month');
  expect(monthsText(40)).toBe('3 years 4 months');
});
