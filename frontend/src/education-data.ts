import { requestJson } from './lib/api';

// Education history (#31 API, #38 list): API calls and display rules. The screens are in educations.tsx.

type Degree = 'high_school' | 'associate' | 'bachelor' | 'master' | 'doctorate' | 'other';
type EducationStatus = 'graduated' | 'enrolled' | 'on_leave' | 'dropped_out';

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

/** "2015-03-02 ~ 2019-02-20", or an open end while the period has not finished. */
export function periodText(education: Pick<Education, 'startDate' | 'endDate'>) {
  return `${education.startDate} ~ ${education.endDate ?? ''}`.trimEnd();
}

/** "학점 3.75 / 4.5", or nothing when no grade was entered. */
export function gpaText(education: Pick<Education, 'gpa' | 'gpaScale'>) {
  if (education.gpa === null || education.gpaScale === null) return '';
  return `학점 ${education.gpa} / ${education.gpaScale}`;
}

export const educationApi = {
  list: () => requestJson<{ educations: Education[] }>('/api/educations'),
};
