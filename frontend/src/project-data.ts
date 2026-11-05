import { requestJson } from './lib/api';

// Projects (#33 API, #42 list): API calls and display rules. The screens are in projects.tsx.

export type Project = {
  id: number;
  name: string;
  organization: string | null;
  startDate: string;
  /** null means the project is still running (#33: there is no separate status field). */
  endDate: string | null;
  role: string | null;
  summary: string | null;
  contributions: string | null;
  technologies: string[];
  repositoryUrl: string | null;
  serviceUrl: string | null;
};

/** A project with no end date is still running. */
export const isRunning = (project: Pick<Project, 'endDate'>) => project.endDate === null;

/** "2023-03-02 ~ 2023-12-29", or "2024-05-01 ~ 진행 중" while the project runs. */
export function projectPeriodText(project: Pick<Project, 'startDate' | 'endDate'>) {
  return `${project.startDate} ~ ${project.endDate ?? '진행 중'}`;
}

/** "커머스개발팀 · 백엔드 개발": the organization and role that were entered. */
export function projectRoleText(project: Pick<Project, 'organization' | 'role'>) {
  return [project.organization, project.role].filter(Boolean).join(' · ');
}

/**
 * The link if it is a web address. The server only stores http(s) links (#33); this keeps any other
 * scheme, such as javascript:, out of an href all the same.
 */
export function webLink(url: string | null) {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

const base = '/api/projects';

export const projectApi = {
  list: () => requestJson<{ projects: Project[] }>(base),
};
