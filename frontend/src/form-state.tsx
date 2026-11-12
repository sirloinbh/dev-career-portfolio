import { type FormEvent, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import type { FieldError } from './field-errors';
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
 * Form state for one item form. `split` turns the server's 400 or 409 message into per-field messages
 * (see field-errors.ts). `submit(save)` runs the save, and on failure shows each message under its
 * field and focuses the topmost one; a message that names no field goes in the notice below the form.
 */
export function useServerForm<F extends string>(split: (message: string) => FieldError<F>[]) {
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
      // 400 is a rule an input broke; 409 is a value taken by another row (a skill name). Both can be
      // about one field, so both are split; any other failure goes in the notice.
      const aboutInput =
        error instanceof RequestError && (error.status === 400 || error.status === 409);
      const pieces = aboutInput ? split(message) : [];
      const byField = Object.fromEntries(
        pieces.flatMap((piece) => (piece.field ? [[piece.field, piece.message]] : [])),
      ) as Partial<Record<F, string>>;
      const first = pieces.find((piece) => piece.field)?.field;
      const unplaced = pieces.length ? pieces.filter((piece) => !piece.field) : [{ message }];
      if (unplaced.length) notice.error(unplaced.map((piece) => piece.message).join(', '));
      if (!first) {
        // The disabled button dropped focus; give it back so keyboard users stay in the form.
        requestAnimationFrame(() => submitButton.current?.focus());
        return;
      }
      // Show each message under its input and move to the first, so it is read with the field.
      setErrors(byField);
      requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
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
