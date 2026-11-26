import { expect, test } from 'vitest';

import type { Career } from './career-data';
import type { Education } from './education-data';
import type { Project } from './project-data';
import { buildTimeline, clusterOverlaps } from './timeline-data';

// All names here are made up for the test.

const today = '2026-11-27';

const career = (
  id: number,
  company: string,
  startDate: string,
  endDate: string | null,
): Career => ({
  id,
  company,
  department: null,
  position: 'Developer',
  employmentType: 'full_time',
  startDate,
  endDate,
  duties: null,
  achievements: null,
});

const education = (
  id: number,
  school: string,
  startDate: string,
  endDate: string | null,
  status: Education['status'] = 'graduated',
): Education => ({
  id,
  school,
  major: null,
  degree: 'bachelor',
  status,
  startDate,
  endDate,
  gpa: null,
  gpaScale: null,
  memo: null,
});

const project = (
  id: number,
  name: string,
  startDate: string,
  endDate: string | null,
  careerId: number | null = null,
): Project => ({
  id,
  name,
  organization: null,
  careerId,
  startDate,
  endDate,
  role: null,
  summary: null,
  contributions: null,
  technologies: [],
  repositoryUrl: null,
  serviceUrl: null,
});

const keys = (clusters: ReturnType<typeof buildTimeline>) =>
  clusters.map((cluster) => cluster.map((item) => item.key));

test('entries of every kind are ordered newest start first', () => {
  const clusters = buildTimeline(
    {
      careers: [
        career(1, 'Old Co', '2016-01-01', '2017-12-31'),
        career(2, 'New Co', '2022-01-01', null),
      ],
      educations: [education(1, 'Test U', '2010-03-01', '2014-02-28')],
      projects: [project(1, 'Side', '2019-05-01', '2019-09-01')],
    },
    today,
  );
  expect(keys(clusters)).toEqual([['career-2'], ['project-1'], ['career-1'], ['education-1']]);
});

test('a running item ends today in the service time zone and is marked ongoing', () => {
  const [[current]] = buildTimeline(
    { careers: [career(1, 'Now Co', '2024-01-02', null)], educations: [], projects: [] },
    today,
  );
  expect(current).toMatchObject({
    end: today,
    ongoing: true,
    periodText: 'January 2, 2024 – Present',
  });
});

test('a graduated record without an end date is a point in time, not a running period', () => {
  const [[done]] = buildTimeline(
    { careers: [], educations: [education(1, 'Test U', '2015-03-02', null)], projects: [] },
    today,
  );
  expect(done).toMatchObject({ end: '2015-03-02', ongoing: false });
  const [[enrolled]] = buildTimeline(
    {
      careers: [],
      educations: [education(2, 'Grad U', '2024-03-04', null, 'enrolled')],
      projects: [],
    },
    today,
  );
  expect(enrolled).toMatchObject({ end: today, ongoing: true });
});

test('overlapping periods share a cluster; a gap starts a new one', () => {
  const clusters = buildTimeline(
    {
      careers: [
        career(1, 'Job A', '2018-01-01', '2021-12-31'),
        career(2, 'Job B', '2023-01-01', null),
      ],
      educations: [education(1, 'Test U', '2020-03-01', '2022-02-28')],
      projects: [],
    },
    today,
  );
  // Job B is alone; the study period overlaps Job A.
  expect(keys(clusters)).toEqual([['career-2'], ['education-1', 'career-1']]);
});

test('a period that starts the day another ends overlaps it', () => {
  const clusters = clusterOverlaps(
    buildTimeline(
      {
        careers: [
          career(1, 'Job A', '2018-01-01', '2020-06-30'),
          career(2, 'Job B', '2020-06-30', '2022-01-01'),
        ],
        educations: [],
        projects: [],
      },
      today,
    ).flat(),
  );
  expect(keys(clusters)).toEqual([['career-2', 'career-1']]);
});

test('a project sits under its career, not on its own; others stay loose', () => {
  const clusters = buildTimeline(
    {
      careers: [career(1, 'Job A', '2018-01-01', '2021-12-31')],
      educations: [],
      projects: [
        project(1, 'Linked early', '2018-02-01', '2018-08-01', 1),
        project(2, 'Linked late', '2019-02-01', '2019-08-01', 1),
        project(3, 'Free', '2025-02-01', null),
        // A link to a career that is not loaded counts as no link.
        project(4, 'Orphan', '2023-02-01', '2023-03-01', 99),
      ],
    },
    today,
  );
  expect(keys(clusters)).toEqual([['project-3'], ['project-4'], ['career-1']]);
  const job = clusters.flat().find((item) => item.key === 'career-1');
  expect(job?.projects.map((p) => p.key)).toEqual(['project-2', 'project-1']);
});

test('an empty set gives an empty timeline', () => {
  expect(buildTimeline({ careers: [], educations: [], projects: [] }, today)).toEqual([]);
});
