import { splitFieldErrors } from './field-errors';
import { requestJson } from './lib/api';
import { formatDate } from './service-date';

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

/** "March 2, 2023 – December 29, 2023", or "May 1, 2024 – Present" while the project runs. */
export function projectPeriodText(project: Pick<Project, 'startDate' | 'endDate'>) {
  return `${formatDate(project.startDate)} – ${project.endDate ? formatDate(project.endDate) : 'Present'}`;
}

/** "Commerce team · Backend development": the organization and role that were entered. */
export function projectRoleText(project: Pick<Project, 'organization' | 'role'>) {
  return [project.organization, project.role].filter(Boolean).join(' · ');
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
 * and the server stores it as NULL; a blank start date goes as '' so the server answers in English.
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
  ['Project name', 'name'],
  ['Organization', 'organization'],
  ['Start date', 'startDate'],
  ['End date', 'endDate'],
  ['Role', 'role'],
  ['Summary', 'summary'],
  ['Contributions', 'contributions'],
  ['Technologies', 'technologies'],
  ['Repository link', 'repositoryUrl'],
  ['Service link', 'serviceUrl'],
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
