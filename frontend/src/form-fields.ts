// Shared by the portfolio item forms. Based on cert-manager frontend/src/form-fields.ts, with
// aria-invalid borders and a stricter number check.

/** Classes for native select and textarea, matching components/ui/input. */
export const controlClass =
  'flex w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none pointer-coarse:min-h-11 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-body-sm dark:bg-input/30';

// Plain decimals only: Number() also reads "Infinity" (sent as null by JSON), "0x4" and "1e1".
const decimal = /^[+-]?(\d+\.?\d*|\.\d+)$/;

// Empty number fields are "not entered" (null). Text that is not a plain decimal goes as it is so the
// server explains.
export function toNumber(value: string) {
  const text = value.trim();
  if (text === '') return null;
  const number = Number(text);
  return decimal.test(text) && Number.isFinite(number) ? number : text;
}
