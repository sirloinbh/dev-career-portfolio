import { expect, test } from 'vitest';

import {
  emptyProjectForm,
  type Project,
  projectFieldOf,
  splitTechnologies,
  toProjectForm,
  toProjectInput,
} from './project-data';

// All projects here are made up for the test.

const past: Project = {
  id: 1,
  name: '사내 위키 검색',
  organization: '한빛소프트',
  startDate: '2021-03-02',
  endDate: '2021-08-31',
  role: '프론트엔드',
  summary: null,
  contributions: null,
  technologies: ['React', 'Elasticsearch'],
  repositoryUrl: 'https://github.com/example/wiki',
  serviceUrl: null,
};

test('a validation path maps to the form field it names', () => {
  for (const field of Object.keys(emptyProjectForm)) expect(projectFieldOf(field)).toBe(field);
  expect(projectFieldOf('')).toBeUndefined();
  expect(projectFieldOf('toString')).toBeUndefined();
  expect(projectFieldOf('technologies.3')).toBe('technologies');
  expect(projectFieldOf('items.0.name')).toBeUndefined();
});

test('form values become the API input and back', () => {
  expect(splitTechnologies('')).toEqual([]);
  expect(splitTechnologies(' , ,')).toEqual([]);
  expect(splitTechnologies('Go,  Rust ')).toEqual(['Go', 'Rust']);
  expect(toProjectInput({ ...emptyProjectForm, endDate: '' }).endDate).toBeNull();
  expect(toProjectInput(emptyProjectForm).technologies).toEqual([]);
  expect(
    toProjectForm({ ...past, organization: null, endDate: null, technologies: [] }),
  ).toMatchObject({ organization: '', endDate: '', technologies: '', serviceUrl: '' });
});
