import { requestJson } from './lib/api';

// Cover letter questions of one application (#37 API, #50 view): API calls and display rules. The
// screen is in cover-letter-questions.tsx.

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

export const coverLetterApi = {
  /** The questions in their saved order. A missing application is a 404. */
  list: (applicationId: string) =>
    requestJson<{ questions: CoverLetterQuestion[] }>(
      `/api/applications/${encodeURIComponent(applicationId)}/questions`,
    ),
};
