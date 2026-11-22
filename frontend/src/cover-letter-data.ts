import { toNumber } from './form-fields';
import { requestJson } from './lib/api';

// Cover letter questions of one application (#37 API, #50 view, #51 form): API calls and display
// rules. The view is in cover-letter-questions.tsx and the form in cover-letter-form.tsx.

export type CoverLetterQuestion = {
  id: number;
  question: string;
  /** null until an answer is written. */
  answer: string | null;
  /** The posting's character limit for the answer; null when it has none. */
  charLimit: number | null;
};

/**
 * Characters in an answer, spaces and line breaks included (#37). Counted by code point, so an emoji
 * is one character, not the two UTF-16 units `length` would give.
 */
export const answerLength = (answer: string | null) => (answer ? [...answer].length : 0);

const count = (value: number) => value.toLocaleString('en-US');

/**
 * "1,204 characters", "1,204 / 1,500 characters", or "1,620 / 1,500 characters · 120 over the limit".
 * #37 stores an answer over the limit, so the screen is where it is pointed out.
 */
export function answerLengthText(question: Pick<CoverLetterQuestion, 'answer' | 'charLimit'>) {
  const length = answerLength(question.answer);
  if (question.charLimit === null) return `${count(length)} characters`;
  const text = `${count(length)} / ${count(question.charLimit)} characters`;
  const over = length - question.charLimit;
  return over > 0 ? `${text} · ${count(over)} over the limit` : text;
}

/** The server takes at most this many questions per application (#37). */
export const maxQuestions = 10;

/**
 * One question in the form. `key` stays with the question while it moves, so React keeps its inputs
 * and a server message stays under the right question. `id` is set once the question is saved.
 */
export type QuestionDraft = {
  key: number;
  id?: number;
  question: string;
  answer: string;
  charLimit: string;
};

export const toDraft = (question: CoverLetterQuestion, key: number): QuestionDraft => ({
  key,
  id: question.id,
  question: question.question,
  answer: question.answer ?? '',
  charLimit: question.charLimit === null ? '' : String(question.charLimit),
});

/**
 * The list as the API takes it, in screen order (the order is the saved order). A blank limit is
 * null; limit text that is not a number goes as it is so the server explains. Blank answers go as ''
 * and the server stores NULL.
 */
export function toQuestionsInput(drafts: QuestionDraft[]) {
  return {
    questions: drafts.map((draft) => ({
      ...(draft.id === undefined ? {} : { id: draft.id }),
      question: draft.question,
      answer: draft.answer,
      charLimit: toNumber(draft.charLimit),
    })),
  };
}

/** The limit typed in the form, when it is one the server would accept; otherwise none. */
export function typedLimit(charLimit: string) {
  const limit = toNumber(charLimit);
  return typeof limit === 'number' && Number.isInteger(limit) && limit >= 1 && limit <= 5000
    ? limit
    : null;
}

/** A form field of one question: `<key>:question`, `<key>:charLimit`, or `<key>:answer`. */
export type QuestionField = `${number}:${'question' | 'charLimit' | 'answer'}`;

/**
 * The question field a server validation path names (`questions.2.answer`), given the keys of the list in the order it
 * was sent. A path about the whole list (`questions`) names no field.
 */
export const questionFieldOf =
  (keys: readonly number[]) =>
  (path: string): QuestionField | undefined => {
    const match = /^questions\.(\d+)\.(question|charLimit|answer)$/.exec(path);
    const key = match ? keys[Number(match[1])] : undefined;
    return match && key !== undefined ? (`${String(key)}:${match[2]}` as QuestionField) : undefined;
  };

const base = (applicationId: string) =>
  `/api/applications/${encodeURIComponent(applicationId)}/questions`;

export const coverLetterApi = {
  /** The questions in their saved order. A missing application is a 404. */
  list: (applicationId: string) =>
    requestJson<{ questions: CoverLetterQuestion[] }>(base(applicationId)),
  /** Saves the whole list at once (#37): questions left out are deleted. */
  save: (applicationId: string, input: ReturnType<typeof toQuestionsInput>) =>
    requestJson<{ questions: CoverLetterQuestion[] }>(base(applicationId), {
      method: 'PUT',
      body: input,
    }),
};
