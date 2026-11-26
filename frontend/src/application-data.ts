import { flatFieldOf } from './form-state';
import { requestJson } from './lib/api';
import { apiKey, useApiQuery } from './lib/query';
import { listQuery } from './list-query';
import { daysUntil, formatDate } from './service-date';

// Applications, shown as "Application" under the Cover letters menu (#36 API, #48 list, #49 form): API
// calls and display rules. The screens are in applications.tsx. One row is one job applied for at one company.

// The same eight hiring stages as backend/src/routes/applications.ts, in the order the form offers them (#229).
export const applicationStatuses = [
  'drafting',
  'submitted',
  'document_passed',
  'first_interview',
  'second_interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;
export type ApplicationStatus = (typeof applicationStatuses)[number];

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
  document_passed: 'Document passed',
  first_interview: 'First interview',
  second_interview: 'Second interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

// The badge style per status. The word carries the status; the fill only helps tell the groups apart:
// writing, sent, interviewing, good news, and ended.
export const applicationStatusVariant = {
  drafting: 'default',
  submitted: 'secondary',
  document_passed: 'secondary',
  first_interview: 'warning',
  second_interview: 'warning',
  offer: 'success',
  rejected: 'destructive',
  withdrawn: 'outline',
} as const satisfies Record<ApplicationStatus, string>;

/**
 * "Due November 20, 2026 · D-15", or "No deadline". The countdown ("D-15", "Due today", "Overdue") only
 * matters while the cover letter is still being written; an application past that stage shows
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

/** How many days ahead the Today page looks (#245). */
export const todayWindowDays = 7;

/**
 * The applications the Today page shows (#245): drafts whose deadline is overdue, today, or within the next
 * `todayWindowDays` days. An application past drafting no longer needs its letter written, and one
 * without a deadline has nothing to be late for. Earliest deadline first, so the most overdue comes first.
 */
export function dueApplications(rows: readonly Application[], today: string) {
  const due = rows
    .filter((row) => row.status === 'drafting' && row.deadline !== null)
    .map((row) => ({ row, days: daysUntil(row.deadline as string, today) }))
    .filter(({ days }) => days <= todayWindowDays)
    .sort((a, b) => a.days - b.days || a.row.companyName.localeCompare(b.row.companyName));
  return {
    overdue: due.filter(({ days }) => days < 0).map(({ row }) => row),
    today: due.filter(({ days }) => days === 0).map(({ row }) => row),
    soon: due.filter(({ days }) => days > 0).map(({ row }) => row),
  };
}

export type ApplicationPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
  /** One application's cover letter questions (#50). */
  questions: (id: number | string) => string;
  /** The form for them (#51). */
  editQuestions: (id: number | string) => string;
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

/** The form field a server validation path names (see form-state.tsx). */
export const applicationFieldOf = flatFieldOf(emptyApplicationForm);

const base = '/api/applications';

/** The list (#152): the list screen and the Edit screen share its cache entry. */
export const applicationList = listQuery(
  base,
  (body: { applications: Application[] }) => body.applications,
);

export const applicationApi = {
  create: (input: ApplicationInput) =>
    requestJson<{ application: Application }>(base, { method: 'POST', body: input }),
  update: (id: number, input: ApplicationInput) =>
    requestJson<{ application: Application }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};

/** One change of stage (#229); `fromStatus` is null for the first row. `date` is YYYY-MM-DD in the service time zone. */
export type StatusChange = {
  id: number;
  fromStatus: ApplicationStatus | null;
  status: ApplicationStatus;
  date: string;
};

export const statusHistoryPath = (applicationId: string) =>
  `/api/applications/${encodeURIComponent(applicationId)}/status-history`;

/** The stage changes of one application, oldest first, through the shared query layer. */
export function useStatusHistory(applicationId: string, enabled: boolean) {
  return useApiQuery<{ history: StatusChange[] }>(
    apiKey(statusHistoryPath(applicationId)),
    statusHistoryPath(applicationId),
    { enabled },
  );
}
