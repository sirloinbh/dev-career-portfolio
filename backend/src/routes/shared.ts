// Input helpers every portfolio item's route module shares (issue #31).
import { z } from 'zod/v4';

/** A real calendar date as YYYY-MM-DD; impossible dates such as 2026-02-30 are rejected. */
export const calendarDate = (label: string) =>
  z.iso.date({ error: `${label}은(는) YYYY-MM-DD 형식의 날짜여야 합니다` });

/** Required text: surrounding spaces are removed and an empty value is rejected. */
export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label}을(를) 입력해 주세요` })
    .trim()
    .min(1, `${label}을(를) 입력해 주세요`)
    .max(max, `${label}은(는) ${max}자 이하여야 합니다`);

/** Optional text: a missing or blank value is stored as NULL, not as an empty string. */
export const optionalText = (label: string, max: number) =>
  z
    .string({ error: `${label}은(는) 문자열이어야 합니다` })
    .trim()
    .max(max, `${label}은(는) ${max}자 이하여야 합니다`)
    .nullable()
    .default(null)
    .transform((value) => (value === '' ? null : value));

/** The body must be a JSON object; express.json() also accepts arrays and bare values. */
export const objectBodyError = { error: '요청 본문은 JSON 객체여야 합니다' };
