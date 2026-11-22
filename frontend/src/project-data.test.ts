import { expect, test } from 'vitest';

import {
  emptyProjectForm,
  type Project,
  projectFieldErrors,
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

test('server messages map to the field they start with', () => {
  const fieldOf = (message: string) => projectFieldErrors(message)[0]?.field;
  expect(fieldOf('Project name is required')).toBe('name');
  expect(fieldOf('Organization must be at most 100 characters')).toBe('organization');
  expect(fieldOf('Start date must be a date in YYYY-MM-DD format')).toBe('startDate');
  expect(fieldOf('End date cannot be earlier than start date')).toBe('endDate');
  expect(fieldOf('Role must be at most 100 characters')).toBe('role');
  expect(fieldOf('Summary must be at most 500 characters')).toBe('summary');
  expect(fieldOf('Contributions must be at most 2000 characters')).toBe('contributions');
  expect(fieldOf('Technologies contain a duplicate item')).toBe('technologies');
  expect(fieldOf('Technologies can have at most 30 items')).toBe('technologies');
  expect(fieldOf('Repository link must not contain spaces')).toBe('repositoryUrl');
  expect(fieldOf('Service link must be at most 500 characters')).toBe('serviceUrl');
  expect(fieldOf('Request body must be a JSON object')).toBeUndefined();
  // More than ten issues end with "and N more", which stays with the message before it.
  expect(
    projectFieldErrors('Technologies items must be at most 50 characters, and 3 more'),
  ).toEqual([
    {
      field: 'technologies',
      message: 'Technologies items must be at most 50 characters, and 3 more',
    },
  ]);
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

test('a long list of the same message keeps the count of the ones not shown', () => {
  const message = 'Technologies items must be at most 50 characters';
  // Ten issues, then the count of the rest; as backend/src/standard/http.ts joins them.
  expect(projectFieldErrors([...Array<string>(10).fill(message), 'and 1 more'].join(', '))).toEqual(
    [{ field: 'technologies', message: `${message}, and 1 more` }],
  );
});
