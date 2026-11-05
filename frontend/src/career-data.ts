import { splitFieldErrors } from './field-errors';
import { requestJson } from './lib/api';

// Work history (#32 API, #40 list, #41 form): API calls and display rules. The screens are in
// careers.tsx.

// The same five values, in the same order, as backend/src/routes/careers.ts.
export const employmentTypes = ['full_time', 'contract', 'intern', 'freelance', 'other'] as const;
type EmploymentType = (typeof employmentTypes)[number];

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

export const employmentTypeLabels: Record<EmploymentType, string> = {
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

export type CareerPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
};

type CareerInput = Omit<Career, 'id'>;

/** The form keeps every field as the text in its input. */
export type CareerForm = {
  company: string;
  department: string;
  position: string;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string;
  duties: string;
  achievements: string;
};

export const emptyCareerForm: CareerForm = {
  company: '',
  department: '',
  position: '',
  employmentType: 'full_time',
  startDate: '',
  endDate: '',
  duties: '',
  achievements: '',
};

export function toCareerForm(career: Career): CareerForm {
  return {
    company: career.company,
    department: career.department ?? '',
    position: career.position ?? '',
    employmentType: career.employmentType,
    startDate: career.startDate,
    endDate: career.endDate ?? '',
    duties: career.duties ?? '',
    achievements: career.achievements ?? '',
  };
}

/**
 * A blank end date means the job is still held, so it goes as null. Blank text goes as '' and the
 * server stores it as NULL; a blank start date goes as '' so the server answers in Korean.
 */
export function toCareerInput(form: CareerForm): CareerInput {
  return { ...form, endDate: form.endDate === '' ? null : form.endDate };
}

// The server's messages start with these labels (backend/src/routes/careers.ts).
const fieldLabels: [string, keyof CareerForm][] = [
  ['회사명', 'company'],
  ['부서', 'department'],
  ['직책', 'position'],
  ['고용 형태', 'employmentType'],
  ['입사일', 'startDate'],
  ['퇴사일', 'endDate'],
  ['담당 업무', 'duties'],
  ['주요 성과', 'achievements'],
];

// The order the inputs appear on screen (careers.tsx CareerFields).
const formOrder: (keyof CareerForm)[] = [
  'company',
  'department',
  'position',
  'employmentType',
  'startDate',
  'endDate',
  'duties',
  'achievements',
];

/** The server's message split per field, topmost field first (see field-errors.ts). */
export const careerFieldErrors = (message: string) =>
  splitFieldErrors(message, fieldLabels, formOrder);

const base = '/api/careers';

export const careerApi = {
  list: () => requestJson<{ careers: Career[] }>(base),
  create: (input: CareerInput) =>
    requestJson<{ career: Career }>(base, { method: 'POST', body: input }),
  update: (id: number, input: CareerInput) =>
    requestJson<{ career: Career }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
