import { splitFieldErrors } from './field-errors';
import { toNumber } from './form-fields';
import { requestJson } from './lib/api';

// Education history (#31 API, #38 list, #39 form): API calls and display rules. The screens are in
// educations.tsx.

export const degrees = [
  'high_school',
  'associate',
  'bachelor',
  'master',
  'doctorate',
  'other',
] as const;
export const statuses = ['graduated', 'enrolled', 'on_leave', 'dropped_out'] as const;
type Degree = (typeof degrees)[number];
type EducationStatus = (typeof statuses)[number];

export type Education = {
  id: number;
  school: string;
  major: string | null;
  degree: Degree;
  status: EducationStatus;
  startDate: string;
  endDate: string | null;
  gpa: number | null;
  gpaScale: number | null;
  memo: string | null;
};

/** What the form sends. Numbers that are not numbers go as text so the server explains in Korean. */
type EducationInput = Omit<Education, 'id' | 'gpa' | 'gpaScale'> & {
  gpa: number | string | null;
  gpaScale: number | string | null;
};

export type EducationPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
};

export const degreeLabels: Record<Degree, string> = {
  high_school: '고등학교',
  associate: '전문학사',
  bachelor: '학사',
  master: '석사',
  doctorate: '박사',
  other: '기타',
};

export const statusLabels: Record<EducationStatus, string> = {
  graduated: '졸업',
  enrolled: '재학 중',
  on_leave: '휴학',
  dropped_out: '중퇴',
};

/**
 * "2015-03-02 ~ 2019-02-20". Without an end date, enrolled and on-leave periods are still running
 * ("2024-03-04 ~"); a finished one with no recorded end shows only its start.
 */
export function periodText(education: Pick<Education, 'status' | 'startDate' | 'endDate'>) {
  if (education.endDate) return `${education.startDate} ~ ${education.endDate}`;
  const running = education.status === 'enrolled' || education.status === 'on_leave';
  return running ? `${education.startDate} ~` : education.startDate;
}

/** "학점 3.75 / 4.5", or nothing when no grade was entered. */
export function gpaText(education: Pick<Education, 'gpa' | 'gpaScale'>) {
  if (education.gpa === null || education.gpaScale === null) return '';
  return `학점 ${education.gpa} / ${education.gpaScale}`;
}

/** The form keeps every field as the text in its input. */
export type EducationForm = {
  school: string;
  major: string;
  degree: Degree;
  status: EducationStatus;
  startDate: string;
  endDate: string;
  gpa: string;
  gpaScale: string;
  memo: string;
};

export const emptyEducationForm: EducationForm = {
  school: '',
  major: '',
  degree: 'bachelor',
  status: 'graduated',
  startDate: '',
  endDate: '',
  gpa: '',
  gpaScale: '',
  memo: '',
};

export function toEducationForm(education: Education): EducationForm {
  return {
    school: education.school,
    major: education.major ?? '',
    degree: education.degree,
    status: education.status,
    startDate: education.startDate,
    endDate: education.endDate ?? '',
    gpa: education.gpa === null ? '' : String(education.gpa),
    gpaScale: education.gpaScale === null ? '' : String(education.gpaScale),
    memo: education.memo ?? '',
  };
}

/**
 * Blank optional fields become null. A blank start date goes as '' so the server answers with its
 * Korean date message; the form does not repeat the server's rules.
 */
export function toEducationInput(form: EducationForm): EducationInput {
  return {
    school: form.school,
    major: form.major,
    degree: form.degree,
    status: form.status,
    startDate: form.startDate,
    endDate: form.endDate === '' ? null : form.endDate,
    gpa: toNumber(form.gpa),
    gpaScale: toNumber(form.gpaScale),
    memo: form.memo,
  };
}

// The server answers one Korean message that starts with the field's label (backend/src/routes/
// educations.ts). Longer labels come first so "졸업일" is not read as another field.
const fieldLabels: [string, keyof EducationForm][] = [
  ['재학 중이면 졸업일', 'endDate'],
  ['학교명', 'school'],
  ['전공', 'major'],
  ['학위', 'degree'],
  ['상태', 'status'],
  ['입학일', 'startDate'],
  ['졸업일', 'endDate'],
  ['학점', 'gpa'],
  ['만점', 'gpaScale'],
  ['메모', 'memo'],
];

// The order the inputs appear on screen (educations.tsx EducationFields).
const formOrder: (keyof EducationForm)[] = [
  'school',
  'major',
  'degree',
  'status',
  'startDate',
  'endDate',
  'gpa',
  'gpaScale',
  'memo',
];

/** The server's message split per field, topmost field first (see field-errors.ts). */
export const fieldErrors = (message: string) => splitFieldErrors(message, fieldLabels, formOrder);

const base = '/api/educations';

export const educationApi = {
  list: () => requestJson<{ educations: Education[] }>(base),
  create: (input: EducationInput) =>
    requestJson<{ education: Education }>(base, { method: 'POST', body: input }),
  update: (id: number, input: EducationInput) =>
    requestJson<{ education: Education }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
