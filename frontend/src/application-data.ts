import { splitFieldErrors } from './field-errors';
import { requestJson } from './lib/api';
import { daysUntil, formatDate } from './service-date';

// Applications, shown as "Application" under the Cover letters menu (#36 API, #48 list, #49 form): API
// calls and display rules. The screens are in applications.tsx. One row is one job applied for at one company.

// The same three values as backend/src/routes/applications.ts, in the order the form offers them.
export const applicationStatuses = ['drafting', 'submitted', 'closed'] as const;
type ApplicationStatus = (typeof applicationStatuses)[number];

export type Application = {
  id: number;
  companyName: string;
  position: string | null;
  postingUrl: string | null;
  /** null means there is no deadline (#36: never a placeholder date). */
  deadline: string | null;
  status: ApplicationStatus;
  memo: string | null;
};

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  drafting: 'Drafting',
  submitted: 'Submitted',
  closed: 'Closed',
};

/**
 * "Due November 20, 2026 · D-15", or "No deadline". The countdown ("D-15", "Due today", "Overdue") only
 * matters while the cover letter is still being written; a submitted or closed application shows
 * the date alone.
 */
export function deadlineText(application: Pick<Application, 'deadline' | 'status'>, today: string) {
  if (application.deadline === null) return 'No deadline';
  const date = `Due ${formatDate(application.deadline)}`;
  if (application.status !== 'drafting') return date;
  const days = daysUntil(application.deadline, today);
  if (days > 0) return `${date} · D-${String(days)}`;
  return `${date} · ${days === 0 ? 'Due today' : 'Overdue'}`;
}

export type ApplicationPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
};

type ApplicationInput = Omit<Application, 'id'>;

/** The form keeps every field as the text in its input; the status is one of the three values. */
export type ApplicationForm = {
  companyName: string;
  position: string;
  postingUrl: string;
  deadline: string;
  status: ApplicationStatus;
  memo: string;
};

// A new application starts as drafting: the cover letter is usually written before it is sent.
export const emptyApplicationForm: ApplicationForm = {
  companyName: '',
  position: '',
  postingUrl: '',
  deadline: '',
  status: 'drafting',
  memo: '',
};

export function toApplicationForm(application: Application): ApplicationForm {
  return {
    companyName: application.companyName,
    position: application.position ?? '',
    postingUrl: application.postingUrl ?? '',
    deadline: application.deadline ?? '',
    status: application.status,
    memo: application.memo ?? '',
  };
}

/**
 * A blank deadline means there is no deadline, so it goes as null. Blank text goes as '' and the
 * server stores it as NULL.
 */
export function toApplicationInput(form: ApplicationForm): ApplicationInput {
  return { ...form, deadline: form.deadline === '' ? null : form.deadline };
}

// The server's messages start with these labels (backend/src/routes/applications.ts).
const fieldLabels: [string, keyof ApplicationForm][] = [
  ['Company name', 'companyName'],
  ['Position', 'position'],
  ['Job posting link', 'postingUrl'],
  ['Deadline', 'deadline'],
  ['Application status', 'status'],
  ['Notes', 'memo'],
];

// The order the inputs appear on screen (applications.tsx ApplicationFields).
const formOrder: (keyof ApplicationForm)[] = [
  'companyName',
  'position',
  'postingUrl',
  'deadline',
  'status',
  'memo',
];

/** The server's message split per field, topmost field first (see field-errors.ts). */
export const applicationFieldErrors = (message: string) =>
  splitFieldErrors(message, fieldLabels, formOrder);

const base = '/api/applications';

export const applicationApi = {
  list: () => requestJson<{ applications: Application[] }>(base),
  create: (input: ApplicationInput) =>
    requestJson<{ application: Application }>(base, { method: 'POST', body: input }),
  update: (id: number, input: ApplicationInput) =>
    requestJson<{ application: Application }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
