import { splitFieldErrors } from './field-errors';
import { toNumber } from './form-fields';
import { requestJson } from './lib/api';
import { formatDate } from './service-date';

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

/** What the form sends. Numbers that are not numbers go as text so the server explains in English. */
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
  high_school: 'High school',
  associate: 'Associate',
  bachelor: 'Bachelor',
  master: 'Master',
  doctorate: 'Doctorate',
  other: 'Other',
};

export const statusLabels: Record<EducationStatus, string> = {
  graduated: 'Graduated',
  enrolled: 'Enrolled',
  on_leave: 'On leave',
  dropped_out: 'Dropped out',
};

/**
 * "March 2, 2015 – February 20, 2019". Without an end date, enrolled and on-leave periods are still
 * running ("March 4, 2024 –"); a finished one with no recorded end shows only its start.
 */
export function periodText(education: Pick<Education, 'status' | 'startDate' | 'endDate'>) {
  if (education.endDate)
    return `${formatDate(education.startDate)} – ${formatDate(education.endDate)}`;
  const running = education.status === 'enrolled' || education.status === 'on_leave';
  return running ? `${formatDate(education.startDate)} –` : formatDate(education.startDate);
}

/** "GPA 3.75 / 4.5", or nothing when no grade was entered. */
export function gpaText(education: Pick<Education, 'gpa' | 'gpaScale'>) {
  if (education.gpa === null || education.gpaScale === null) return '';
  return `GPA ${education.gpa} / ${education.gpaScale}`;
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
 * date message; the form does not repeat the server's rules.
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

// The server answers one message that starts with the field's label (backend/src/routes/
// educations.ts). Longer labels come first so "Graduation date" is not read as another field.
const fieldLabels: [string, keyof EducationForm][] = [
  ['School', 'school'],
  ['Major', 'major'],
  ['Degree', 'degree'],
  ['Status', 'status'],
  ['Enrollment date', 'startDate'],
  ['Graduation date', 'endDate'],
  ['GPA', 'gpa'],
  ['Maximum GPA', 'gpaScale'],
  ['Notes', 'memo'],
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
