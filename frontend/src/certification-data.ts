import { requestJson } from './lib/api';

// Certifications (#35 API, #46 list): API calls and display rules. The screens are in
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

const base = '/api/certifications';

export const certificationApi = {
  list: () => requestJson<{ certifications: Certification[] }>(base),
};
