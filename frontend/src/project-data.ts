import { flatFieldOf } from './form-state';
import { requestJson } from './lib/api';
import { formatDate } from './lib/format';
import { listQuery } from './list-query';

// Projects (#33 API, #42 list, #43 form): API calls and display rules. The screens are in
// projects.tsx.

export type Project = {
  id: number;
  name: string;
  /** Free text for a project outside any career; used only when `careerId` is null (#224). */
  organization: string | null;
  /** The career this project was done at, or null. */
  careerId: number | null;
  startDate: string;
  /** null means the project is still running (#33: there is no separate status field). */
  endDate: string | null;
  role: string | null;
  summary: string | null;
  contributions: string | null;
  /** The skills this project used, by skill id, in skill-name order (#225). */
  skillIds: number[];
  repositoryUrl: string | null;
  serviceUrl: string | null;
};

/** A project with no end date is still running. */
export const isRunning = (project: Pick<Project, 'endDate'>) => project.endDate === null;

/** "March 2, 2023 – December 29, 2023", or "May 1, 2024 – Present" while the project runs. */
export function projectPeriodText(project: Pick<Project, 'startDate' | 'endDate'>) {
  return `${formatDate(project.startDate)} – ${project.endDate ? formatDate(project.endDate) : 'Present'}`;
}

/**
 * "Hanbit Soft · Backend development": the company of the linked career, or the free-text organization
 * when no career is linked, then the role. `careerCompany` is the linked career's name, if it is known.
 */
export function projectRoleText(
  project: Pick<Project, 'organization' | 'role'>,
  careerCompany?: string | null,
) {
  return [careerCompany || project.organization, project.role].filter(Boolean).join(' · ');
}

export type ProjectPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
};

type ProjectInput = Omit<Project, 'id'>;

/** The form keeps every field as the text in its input; the skills are the ids picked from the skill list. */
export type ProjectForm = {
  name: string;
  organization: string;
  /** The picked career's id as the select's text; '' means none. */
  careerId: string;
  startDate: string;
  endDate: string;
  role: string;
  summary: string;
  contributions: string;
  skillIds: number[];
  repositoryUrl: string;
  serviceUrl: string;
};

export const emptyProjectForm: ProjectForm = {
  name: '',
  organization: '',
  careerId: '',
  startDate: '',
  endDate: '',
  role: '',
  summary: '',
  contributions: '',
  skillIds: [],
  repositoryUrl: '',
  serviceUrl: '',
};

export function toProjectForm(project: Project): ProjectForm {
  return {
    name: project.name,
    organization: project.organization ?? '',
    careerId: project.careerId === null ? '' : String(project.careerId),
    startDate: project.startDate,
    endDate: project.endDate ?? '',
    role: project.role ?? '',
    summary: project.summary ?? '',
    contributions: project.contributions ?? '',
    skillIds: project.skillIds,
    repositoryUrl: project.repositoryUrl ?? '',
    serviceUrl: project.serviceUrl ?? '',
  };
}

/**
 * A blank end date means the project is still running, so it goes as null. Blank text goes as ''
 * and the server stores it as NULL; a blank start date goes as '' so the server answers in English.
 */
export function toProjectInput(form: ProjectForm): ProjectInput {
  return {
    ...form,
    careerId: form.careerId === '' ? null : Number(form.careerId),
    endDate: form.endDate === '' ? null : form.endDate,
  };
}

/** The form field a server validation path names (see form-state.tsx). */
export const projectFieldOf = flatFieldOf(emptyProjectForm);

const base = '/api/projects';

/** The list (#152): the list screen and the Edit screen share its cache entry. */
export const projectList = listQuery(base, (body: { projects: Project[] }) => body.projects);

export const projectApi = {
  create: (input: ProjectInput) =>
    requestJson<{ project: Project }>(base, { method: 'POST', body: input }),
  update: (id: number, input: ProjectInput) =>
    requestJson<{ project: Project }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
