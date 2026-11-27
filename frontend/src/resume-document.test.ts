import { expect, test } from 'vitest';

import type { Career } from './career-data';
import type { Certification } from './certification-data';
import type { Education } from './education-data';
import type { Project } from './project-data';
import {
  buildResume,
  type ResumeData,
  resumeHtml,
  resumeMarkdown,
  type ResumeSectionKey,
  type ResumeSelection,
} from './resume-document';
import type { Skill } from './skill-data';

// All data here is made up for the test.

const career: Career = {
  id: 1,
  company: 'Hanbit Soft',
  department: 'Backend',
  position: 'Senior',
  employmentType: 'full_time',
  startDate: '2020-03-02',
  endDate: null,
  duties: 'Built settlement batches\nRan on-call',
  achievements: null,
};
const project: Project = {
  id: 2,
  name: 'Settlement <v2> & more',
  organization: null,
  careerId: 1,
  startDate: '2024-05-01',
  endDate: '2024-12-31',
  role: 'Lead',
  summary: 'Moved month-end settlement to a batch',
  contributions: null,
  skillIds: [3, 99],
  repositoryUrl: null,
  serviceUrl: null,
};
const education: Education = {
  id: 4,
  school: 'Seoul Univ',
  major: 'CS',
  degree: 'bachelor',
  status: 'graduated',
  startDate: '2012-03-02',
  endDate: '2016-02-20',
  gpa: 3.8,
  gpaScale: 4.5,
  memo: null,
};
const certification: Certification = {
  id: 5,
  name: 'Engineer Information Processing',
  issuer: 'HRDK',
  acquiredDate: '2019-05-17',
  expiryDate: null,
  score: null,
  memo: null,
};
const skill: Skill = {
  id: 3,
  name: 'TypeScript',
  category: 'language',
  proficiency: 4,
  memo: null,
};

const data: ResumeData = {
  careers: [career],
  projects: [project],
  educations: [education],
  certifications: [certification],
  skills: [skill],
};

const pick = (ids: Partial<Record<ResumeSectionKey, number[]>>): ResumeSelection => ({
  careers: new Set(ids.careers),
  projects: new Set(ids.projects),
  educations: new Set(ids.educations),
  certifications: new Set(ids.certifications),
  skills: new Set(ids.skills),
});

test('only the chosen items are built, and sections with nothing chosen are left out', () => {
  const sections = buildResume(data, pick({ projects: [2], skills: [3] }));
  expect(sections.map((s) => s.key)).toEqual(['projects', 'skills']);
  const [entry] = sections[0].entries;
  expect(entry.heading).toBe('Settlement <v2> & more');
  // The linked career gives the company; an unknown skill id is ignored.
  expect(entry.meta).toEqual(['May 1, 2024 – December 31, 2024', 'Hanbit Soft · Lead']);
  expect(entry.tags).toEqual(['TypeScript']);
  expect(entry.blocks).toEqual([
    { label: 'Summary', text: 'Moved month-end settlement to a batch' },
  ]);
  expect(buildResume(data, pick({}))).toEqual([]);
});

test('Markdown has one heading per section and entry, and skips blocks that were not filled in', () => {
  expect(resumeMarkdown(buildResume(data, pick({ careers: [1], educations: [4] })))).toBe(
    [
      '# Resume',
      '',
      '## Career',
      '',
      '### Hanbit Soft',
      '',
      '_March 2, 2020 – Present · Backend · Senior · Full-time_',
      '',
      '**Duties**',
      '',
      'Built settlement batches\nRan on-call',
      '',
      '## Education',
      '',
      '### Seoul Univ',
      '',
      '_Bachelor, CS · Graduated · March 2, 2012 – February 20, 2016 · GPA 3.8 / 4.5_',
      '',
    ].join('\n'),
  );
  expect(resumeMarkdown([])).toBe('# Resume\n');
});

test('the print page escapes typed text and sets A4', () => {
  const html = resumeHtml(buildResume(data, pick({ projects: [2] })));
  expect(html).toContain('Settlement &lt;v2&gt; &amp; more');
  expect(html).not.toContain('<v2>');
  expect(html).toContain('size: A4');
  expect(html).toContain('<p>TypeScript</p>');
});
