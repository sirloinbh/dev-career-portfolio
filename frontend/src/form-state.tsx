import { type FormEvent, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';

// What every portfolio item form shares (#39 structure, shared from #41): the server validates, and
// its messages are shown under the field they are about.

/**
 * The value to send for a date input. A date typed only in part ("2023-12-__") reads as '' in the
 * browser, which an optional date would save as "no date" (a job still held, say). It goes as text
 * the server refuses instead, so the message appears under that field. A disabled input is
 * not the user's to finish, so it sends its value as is.
 */
export function typedDate(input: HTMLInputElement | null, value: string) {
  return input && !input.disabled && input.validity.badInput ? 'incomplete' : value;
}

/**
 * The field of a flat form that a validation path names, or undefined: the server's paths start with the input's key
 * (`company`, or `technologies.3` for one list item), and those are the form's keys too. `form` is any value of the
 * form, such as its empty one.
 */
export const flatFieldOf =
  <F extends string>(form: Record<F, unknown>) =>
  (path: string): F | undefined => {
    const key = path.split('.')[0];
    return Object.hasOwn(form, key) ? (key as F) : undefined;
  };

/**
 * Form state for one item form. `fieldOf` maps the path of a 400 body's `fields` entry to the form field it is
 * about. `submit(save)` runs the save, and on failure shows each message under its field and focuses the first
 * one in the page; a message that names no field goes in the notice below the form. A 409 has no paths:
 * `conflictField` (a taken skill name) is the field its message belongs under.
 */
export function useServerForm<F extends string>(
  fieldOf: (path: string) => F | undefined,
  options: { conflictField?: F } = {},
) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<F, string>>>({});
  const notice = useNotice();
  const submitButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const fieldId = (field: F) => `${id}-${field}`;

  /** aria props that tie a field to its hints and to the server's message about it. */
  const describe = (field: F, ...hints: string[]) => {
    const invalid = errors[field] !== undefined;
    const ids = [...hints, invalid ? `${fieldId(field)}-error` : undefined]
      .filter(Boolean)
      .join(' ');
    return { 'aria-invalid': invalid || undefined, 'aria-describedby': ids || undefined };
  };

  const errorFor = (field: F) =>
    errors[field] !== undefined ? (
      <p id={`${fieldId(field)}-error`} className="text-body-sm break-keep text-destructive">
        {errors[field]}
      </p>
    ) : null;

  const clearError = (field: F) => setErrors((current) => ({ ...current, [field]: undefined }));

  const submit = (save: () => Promise<unknown>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    notice.clear();
    save().catch((error: unknown) => {
      setPending(false);
      const message = errorText(error, 'Could not save');
      const byField: Partial<Record<F, string[]>> = {};
      const unplaced: string[] = [];
      const place = (field: F | undefined, text: string) => {
        if (field === undefined) unplaced.push(text);
        else if (!byField[field]?.includes(text)) (byField[field] ??= []).push(text);
      };
      if (error instanceof RequestError && error.status === 400 && error.fields.length > 0) {
        for (const item of error.fields) place(fieldOf(item.path), item.message);
      } else if (error instanceof RequestError && error.status === 409) {
        place(options.conflictField, message);
      } else {
        unplaced.push(message);
      }
      if (unplaced.length) notice.error(unplaced.join(', '));
      const placed = Object.keys(byField) as F[];
      const first = placed
        .map((field) => document.getElementById(fieldId(field)))
        .filter((element) => element !== null)
        .sort((a, b) =>
          a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
        )[0];
      if (!first) {
        // The disabled button dropped focus; give it back so keyboard users stay in the form.
        requestAnimationFrame(() => submitButton.current?.focus());
        return;
      }
      // Show each message under its input and move to the first, so it is read with the field.
      setErrors(
        Object.fromEntries(placed.map((field) => [field, byField[field]?.join(', ')])) as Partial<
          Record<F, string>
        >,
      );
      requestAnimationFrame(() => first.focus());
    });
  };

  const actions = ({ submitLabel, cancelTo }: { submitLabel: string; cancelTo: string }) => (
    <>
      <Notice notice={notice.notice} />
      <div className="flex flex-wrap gap-2">
        <Button
          ref={submitButton}
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? <Spinner size="sm" label="Saving" /> : null}
          {submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
    </>
  );

  return { pending, fieldId, describe, errorFor, clearError, submit, actions };
}
