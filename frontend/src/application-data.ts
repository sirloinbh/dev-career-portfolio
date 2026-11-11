import { requestJson } from './lib/api';
import { daysUntil, formatDate } from './service-date';

// Applications, shown as "Application" under the Cover letters menu (#36 API, #48 list): API calls and
// display rules. The screens are in applications.tsx. One row is one job applied for at one company.

// The same three values as backend/src/routes/applications.ts.
type ApplicationStatus = 'drafting' | 'submitted' | 'closed';

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

const base = '/api/applications';

export const applicationApi = {
  list: () => requestJson<{ applications: Application[] }>(base),
};
