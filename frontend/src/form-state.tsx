import { type FormEvent, useId, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Button } from './components/ui/button';
import { Notice } from './components/ui/notice';
import { Spinner } from './components/ui/spinner';
import type { FieldError } from './field-errors';
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';

// What every portfolio item form shares (#39 structure, shared from #41): the server validates, and
// its Korean messages are shown under the field they are about.

/**
 * Form state for one item form. `split` turns the server's 400 message into per-field messages
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
      const message = errorText(error, '저장하지 못했습니다');
      const pieces = error instanceof RequestError && error.status === 400 ? split(message) : [];
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
      // Show each Korean message under its input and move to the first, so it is read with the field.
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
          {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
          {submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>취소</Link>
        </Button>
      </div>
    </>
  );

  return { pending, fieldId, describe, errorFor, clearError, submit, actions };
}
