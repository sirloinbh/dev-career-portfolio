import { requestJson } from './lib/api';

// Work history (#32 API, #40 list): API calls and display rules. The screens are in careers.tsx.

// The same five values as backend/src/routes/careers.ts.
type EmploymentType = 'full_time' | 'contract' | 'intern' | 'freelance' | 'other';

export type Career = {
  id: number;
  company: string;
  department: string | null;
  position: string | null;
  employmentType: EmploymentType;
  startDate: string;
  /** null means the job is still held (#32: there is no separate status field). */
  endDate: string | null;
  duties: string | null;
  achievements: string | null;
};

const employmentTypeLabels: Record<EmploymentType, string> = {
  full_time: '정규직',
  contract: '계약직',
  intern: '인턴',
  freelance: '프리랜서',
  other: '기타',
};

/** A job with no end date is the one still held. */
export const isCurrent = (career: Pick<Career, 'endDate'>) => career.endDate === null;

/** "2020-03-02 ~ 2023-12-29", or "2024-01-02 ~ 재직 중" while the job is held. */
export function careerPeriodText(career: Pick<Career, 'startDate' | 'endDate'>) {
  return `${career.startDate} ~ ${career.endDate ?? '재직 중'}`;
}

/** "백엔드팀 · 선임 · 정규직": the parts that were entered, then the employment type. */
export function roleText(career: Pick<Career, 'department' | 'position' | 'employmentType'>) {
  return [career.department, career.position, employmentTypeLabels[career.employmentType]]
    .filter(Boolean)
    .join(' · ');
}

const base = '/api/careers';

export const careerApi = {
  list: () => requestJson<{ careers: Career[] }>(base),
};
