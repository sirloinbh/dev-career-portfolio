import { splitFieldErrors } from './field-errors';
import { requestJson } from './lib/api';

// Projects (#33 API, #42 list, #43 form): API calls and display rules. The screens are in
// projects.tsx.

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

export type ProjectPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
};

type ProjectInput = Omit<Project, 'id'>;

/** The form keeps every field as the text in its input; technologies are one comma-separated line. */
export type ProjectForm = {
  name: string;
  organization: string;
  startDate: string;
  endDate: string;
  role: string;
  summary: string;
  contributions: string;
  technologies: string;
  repositoryUrl: string;
  serviceUrl: string;
};

export const emptyProjectForm: ProjectForm = {
  name: '',
  organization: '',
  startDate: '',
  endDate: '',
  role: '',
  summary: '',
  contributions: '',
  technologies: '',
  repositoryUrl: '',
  serviceUrl: '',
};

export function toProjectForm(project: Project): ProjectForm {
  return {
    name: project.name,
    organization: project.organization ?? '',
    startDate: project.startDate,
    endDate: project.endDate ?? '',
    role: project.role ?? '',
    summary: project.summary ?? '',
    contributions: project.contributions ?? '',
    technologies: project.technologies.join(', '),
    repositoryUrl: project.repositoryUrl ?? '',
    serviceUrl: project.serviceUrl ?? '',
  };
}

/**
 * "TypeScript, PostgreSQL," → ["TypeScript", "PostgreSQL"]. The pieces between commas are trimmed
 * and empty ones (a trailing comma) dropped; length, count and duplicates are the server's to check.
 */
export function splitTechnologies(text: string) {
  return text
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '');
}

/**
 * A blank end date means the project is still running, so it goes as null. Blank text goes as ''
 * and the server stores it as NULL; a blank start date goes as '' so the server answers in Korean.
 */
export function toProjectInput(form: ProjectForm): ProjectInput {
  return {
    ...form,
    endDate: form.endDate === '' ? null : form.endDate,
    technologies: splitTechnologies(form.technologies),
  };
}

// The server's messages start with these labels (backend/src/routes/projects.ts, shared.ts).
const fieldLabels: [string, keyof ProjectForm][] = [
  ['프로젝트명', 'name'],
  ['소속', 'organization'],
  ['시작일', 'startDate'],
  ['종료일', 'endDate'],
  ['역할', 'role'],
  ['요약', 'summary'],
  ['기여와 성과', 'contributions'],
  ['사용 기술', 'technologies'],
  ['저장소 링크', 'repositoryUrl'],
  ['서비스 링크', 'serviceUrl'],
];

// The order the inputs appear on screen (projects.tsx ProjectFields).
const formOrder: (keyof ProjectForm)[] = [
  'name',
  'organization',
  'role',
  'startDate',
  'endDate',
  'summary',
  'contributions',
  'technologies',
  'repositoryUrl',
  'serviceUrl',
];

/** The server's message split per field, topmost field first (see field-errors.ts). */
export const projectFieldErrors = (message: string) =>
  splitFieldErrors(message, fieldLabels, formOrder);

const base = '/api/projects';

export const projectApi = {
  list: () => requestJson<{ projects: Project[] }>(base),
  create: (input: ProjectInput) =>
    requestJson<{ project: Project }>(base, { method: 'POST', body: input }),
  update: (id: number, input: ProjectInput) =>
    requestJson<{ project: Project }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
