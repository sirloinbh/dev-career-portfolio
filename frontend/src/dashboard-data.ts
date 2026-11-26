import { formatDate } from './service-date';

// Dashboard (#221): the shape of GET /api/dashboard and the display rules. The screen is in dashboard.tsx.

export const dashboardSections = [
  'educations',
  'careers',
  'projects',
  'skills',
  'certifications',
  'applications',
] as const;
export type DashboardSection = (typeof dashboardSections)[number];

export type Dashboard = {
  today: string;
  windows: { deadlineDays: number; expiryDays: number };
  counts: Record<DashboardSection, number>;
  upcomingDeadlines: {
    id: number;
    companyName: string;
    position: string | null;
    deadline: string;
  }[];
  expiringCertifications: { id: number; name: string; issuer: string; expiryDate: string }[];
  recentlyChanged: { section: DashboardSection; id: number; title: string; updatedAt: string }[];
};

export const sectionLabels: Record<DashboardSection, string> = {
  educations: 'Education',
  careers: 'Career',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  applications: 'Cover letters',
};

/** "Due today", "Due tomorrow" or "D-5" for a date inside the window; dates are YYYY-MM-DD in the service time zone. */
function countdownText(days: number) {
  if (days === 0) return 'Today';
  return `D-${String(days)}`;
}

/** "November 20, 2026 · D-4". */
export function dateWithCountdown(date: string, days: number) {
  return `${formatDate(date)} · ${countdownText(days)}`;
}

/** "5 items" / "1 item". */
export function itemCountText(count: number) {
  return `${String(count)} ${count === 1 ? 'item' : 'items'}`;
}
