// Splits the server's validation message into one message per form field (#39, shared from #41).

export type FieldError<F extends string> = { field: F | undefined; message: string };

/**
 * The server answers one Korean message that starts with the field's label, and joins several with
 * ", " (backend/src/standard/http.ts). A message can hold commas itself ("고등학교, 전문학사, …"), so a
 * piece that names no field stays with the one before. Messages about the same field are joined even
 * when another field's message sits between them (zod reports per-field issues before the
 * cross-field ones); the same message twice (one per list item, "사용 기술 항목은 50자 …") is shown once.
 * Fields come in screen order, so the screen focuses the topmost one; a piece
 * that names no field goes last.
 *
 * `labels` maps a message start to its field; put longer labels first so "재학 중이면 졸업일" is not
 * read as another field. `order` is the order the inputs appear on screen.
 */
/** The count the server adds when it shows only the first ten issues (backend/src/standard/http.ts). */
const overflow = /, 외 \d+개$/;

export function splitFieldErrors<F extends string>(
  message: string,
  labels: readonly (readonly [string, F])[],
  order: readonly F[],
): FieldError<F>[] {
  const fieldOf = (text: string) => labels.find(([label]) => text.startsWith(label))?.[1];
  const pieces: FieldError<F>[] = [];
  for (const text of message.split(', ')) {
    const field = fieldOf(text);
    if (field === undefined && pieces.length > 0) {
      pieces[pieces.length - 1].message += `, ${text}`;
    } else {
      pieces.push({ field, message: text });
    }
  }
  const grouped: FieldError<F>[] = [];
  for (const piece of pieces) {
    const same = piece.field && grouped.find((item) => item.field === piece.field);
    if (same) {
      // The server ends a long list with "외 N개", which arrives stuck to the last message; keep it
      // even when that message is already shown.
      const message = piece.message.replace(overflow, '');
      const rest = piece.message.slice(message.length);
      // Compared with the separators around it, since a message can hold ", " itself.
      const shown = `, ${same.message}, `.includes(`, ${message}, `);
      same.message += shown ? rest : `, ${piece.message}`;
    } else grouped.push(piece);
  }
  const position = (field: F | undefined) =>
    field === undefined ? order.length : order.indexOf(field);
  return grouped.sort((a, b) => position(a.field) - position(b.field));
}
