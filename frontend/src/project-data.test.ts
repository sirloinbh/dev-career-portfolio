import { expect, test } from 'vitest';

import {
  emptyProjectForm,
  type Project,
  projectFieldOf,
  toProjectForm,
  toProjectInput,
} from './project-data';

// All projects here are made up for the test.

const past: Project = {
  id: 1,
  name: '사내 위키 검색',
  organization: '한빛소프트',
  careerId: null,
  startDate: '2021-03-02',
  endDate: '2021-08-31',
  role: '프론트엔드',
  summary: null,
  contributions: null,
  skillIds: [1, 2],
  repositoryUrl: 'https://github.com/example/wiki',
  serviceUrl: null,
};

test('a validation path maps to the form field it names', () => {
  for (const field of Object.keys(emptyProjectForm)) expect(projectFieldOf(field)).toBe(field);
  expect(projectFieldOf('')).toBeUndefined();
  expect(projectFieldOf('toString')).toBeUndefined();
  expect(projectFieldOf('skillIds.3')).toBe('skillIds');
  expect(projectFieldOf('items.0.name')).toBeUndefined();
});

test('form values become the API input and back', () => {
  expect(toProjectInput({ ...emptyProjectForm, endDate: '' }).endDate).toBeNull();
  expect(toProjectInput(emptyProjectForm).skillIds).toEqual([]);
  expect(toProjectInput({ ...emptyProjectForm, skillIds: [3, 1] }).skillIds).toEqual([3, 1]);
  expect(toProjectForm({ ...past, organization: null, endDate: null, skillIds: [] })).toMatchObject(
    { organization: '', endDate: '', skillIds: [], serviceUrl: '' },
  );
  expect(toProjectForm(past).skillIds).toEqual([1, 2]);
});
