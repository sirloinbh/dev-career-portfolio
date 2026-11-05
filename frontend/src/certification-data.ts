import { splitFieldErrors } from './field-errors';
import { requestJson } from './lib/api';

// Certifications (#35 API, #46 list, #47 form): API calls and display rules. The screens are in
// certifications.tsx.

export type Certification = {
  id: number;
  name: string;
  issuer: string;
  acquiredDate: string;
  /** null means the certification never expires (#35: never a placeholder date). */
  expiryDate: string | null;
  /** Text, not a number: "905점", "1급", "IH". */
  score: string | null;
  memo: string | null;
};

/** Today as YYYY-MM-DD in the service time zone (Asia/Seoul), like the API's serviceDate. */
export function serviceToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Expired once the expiry date has passed. The expiry date itself still counts as valid, and a
 * certification without one never expires. YYYY-MM-DD strings compare in date order.
 */
export const isExpired = (certification: Pick<Certification, 'expiryDate'>, today: string) =>
  certification.expiryDate !== null && certification.expiryDate < today;

/** "취득 2024-05-17 · 만료 2026-05-16", or "· 만료 없음" when it never expires. */
export function certificationPeriodText(
  certification: Pick<Certification, 'acquiredDate' | 'expiryDate'>,
) {
  return `취득 ${certification.acquiredDate} · 만료 ${certification.expiryDate ?? '없음'}`;
}

/** "한국산업인력공단 · 905점": the issuer, then the score or grade when one was entered. */
export function issuerText(certification: Pick<Certification, 'issuer' | 'score'>) {
  return [certification.issuer, certification.score].filter(Boolean).join(' · ');
}

export type CertificationPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
};

type CertificationInput = Omit<Certification, 'id'>;

/** The form keeps every field as the text in its input. */
export type CertificationForm = {
  name: string;
  issuer: string;
  acquiredDate: string;
  expiryDate: string;
  score: string;
  memo: string;
};

export const emptyCertificationForm: CertificationForm = {
  name: '',
  issuer: '',
  acquiredDate: '',
  expiryDate: '',
  score: '',
  memo: '',
};

export function toCertificationForm(certification: Certification): CertificationForm {
  return {
    name: certification.name,
    issuer: certification.issuer,
    acquiredDate: certification.acquiredDate,
    expiryDate: certification.expiryDate ?? '',
    score: certification.score ?? '',
    memo: certification.memo ?? '',
  };
}

/**
 * A blank expiry date means the certification never expires, so it goes as null. Blank text goes
 * as '' and the server stores it as NULL; a blank acquired date goes as '' so the server answers in
 * Korean.
 */
export function toCertificationInput(form: CertificationForm): CertificationInput {
  return { ...form, expiryDate: form.expiryDate === '' ? null : form.expiryDate };
}

// The server's messages start with these labels (backend/src/routes/certifications.ts).
const fieldLabels: [string, keyof CertificationForm][] = [
  ['자격증명', 'name'],
  ['발급 기관', 'issuer'],
  ['취득일', 'acquiredDate'],
  ['만료일', 'expiryDate'],
  ['점수·등급', 'score'],
  ['메모', 'memo'],
];

// The order the inputs appear on screen (certifications.tsx CertificationFields).
const formOrder: (keyof CertificationForm)[] = [
  'name',
  'issuer',
  'acquiredDate',
  'expiryDate',
  'score',
  'memo',
];

/** The server's message split per field, topmost field first (see field-errors.ts). */
export const certificationFieldErrors = (message: string) =>
  splitFieldErrors(message, fieldLabels, formOrder);

const base = '/api/certifications';

export const certificationApi = {
  list: () => requestJson<{ certifications: Certification[] }>(base),
  create: (input: CertificationInput) =>
    requestJson<{ certification: Certification }>(base, { method: 'POST', body: input }),
  update: (id: number, input: CertificationInput) =>
    requestJson<{ certification: Certification }>(`${base}/${id}`, {
      method: 'PUT',
      body: input,
    }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
