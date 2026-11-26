import { expect, test } from 'vitest';

import { type Interview, isUpcoming, nextRound, toInterviewInput } from './interview-data';

const interview = (round: number): Interview => ({
  id: round,
  round,
  date: '2026-11-10',
  time: '10:00',
  format: 'video',
  questions: null,
  retrospective: null,
});

test('the next round follows the highest saved round and stops at 20', () => {
  expect(nextRound([])).toBe('1');
  expect(nextRound([interview(2), interview(1)])).toBe('3');
  expect(nextRound([interview(20)])).toBe('20');
});

test('an interview today or later is upcoming', () => {
  expect(isUpcoming({ date: '2026-11-10' }, '2026-11-10')).toBe(true);
  expect(isUpcoming({ date: '2026-11-09' }, '2026-11-10')).toBe(false);
});

test('round text that is not a number goes as it is for the server to explain', () => {
  const form = {
    round: '2',
    date: '',
    time: '',
    format: 'phone',
    questions: '',
    retrospective: '',
  } as const;
  expect(toInterviewInput(form).round).toBe(2);
  expect(toInterviewInput({ ...form, round: 'two' }).round).toBe('two');
  expect(toInterviewInput({ ...form, round: '' }).round).toBeNull();
});
