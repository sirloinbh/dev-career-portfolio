// Input helpers every portfolio item's route module shares (issue #31).
import { z } from 'zod/v4';

/**
 * A real calendar date as YYYY-MM-DD; impossible dates such as 2026-02-30 are rejected, and so is
 * year 0000, which zod accepts but PostgreSQL does not. `abort` stops a bad value here, so a
 * cross-field rule never compares it and reports a second, false error.
 */
export const calendarDate = (label: string) =>
  z.iso
    .date({ error: `${label} must be a date in YYYY-MM-DD format`, abort: true })
    .refine((value) => value >= '0001-01-01', {
      error: `${label} must be on or after 0001-01-01`,
      abort: true,
    });

/** Required text: surrounding spaces are removed and an empty value is rejected. */
export const requiredText = (label: string, max: number) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${String(max)} characters`);

/** Optional text: a missing or blank value is stored as NULL, not as an empty string. */
export const optionalText = (label: string, max: number) =>
  z
    .string({ error: `${label} must be text` })
    .trim()
    .max(max, `${label} must be at most ${String(max)} characters`)
    .nullable()
    .default(null)
    .transform((value) => (value === '' ? null : value));

// The prefix check matches the DB constraint: URL alone repairs "https:example.com" into a valid
// address, so the raw text is checked before parsing.
const isWebAddress = (value: string) => {
  if (!/^https?:\/\//i.test(value)) return false;
  if (!URL.canParse(value)) return false;
  const { protocol, hostname } = new URL(value);
  return (protocol === 'http:' || protocol === 'https:') && hostname !== '';
};

/**
 * Optional web link: only http(s) addresses, so a stored link never opens javascript: or a local
 * file. A missing or blank value is stored as NULL.
 */
export const optionalLink = (label: string) =>
  z
    .string({ error: `${label} must be text` })
    .trim()
    .max(500, `${label} must be at most 500 characters`)
    .superRefine((value, ctx) => {
      if (value === '') return;
      // URL silently drops tabs and line breaks, so the stored text would differ from the opened
      // link. Spaces get their own message because the address may already start with https://.
      if (/\s/.test(value)) {
        ctx.addIssue({ code: 'custom', message: `${label} must not contain spaces` });
      } else if (!isWebAddress(value)) {
        ctx.addIssue({
          code: 'custom',
          message: `${label} must start with http:// or https://`,
        });
      }
    })
    .nullable()
    .default(null)
    .transform((value) => (value === '' ? null : value));

/** The body must be a JSON object; express.json() also accepts arrays and bare values. */
export const objectBodyError = { error: 'Request body must be a JSON object' };
