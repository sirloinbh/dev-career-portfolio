import { toNumber } from './form-fields';
import { requestJson } from './lib/api';
import { apiKey, useApiQuery } from './lib/query';

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

/**
 * Characters in an answer without any whitespace: spaces, tabs, line breaks and other Unicode white space
 * are left out (#232). Some companies count this way. Counted by code point like `answerLength`.
 */
export const answerLengthWithoutSpaces = (answer: string | null) =>
  answer ? [...answer.replace(/\s/gu, '')].length : 0;

const count = (value: number) => value.toLocaleString('en-US');

/**
 * "1,204 characters (1,032 without spaces)", "1,204 characters (1,032 without spaces) / 1,500", or
 * "1,620 characters (1,400 without spaces) / 1,500 · 120 over the limit". The limit and the warning use the
 * count with spaces. #37 stores an answer over the limit, so the screen is where it is pointed out.
 */
export function answerLengthText(question: Pick<CoverLetterQuestion, 'answer' | 'charLimit'>) {
  const length = answerLength(question.answer);
  const text = `${count(length)} characters (${count(answerLengthWithoutSpaces(question.answer))} without spaces)`;
  if (question.charLimit === null) return text;
  const withLimit = `${text} / ${count(question.charLimit)}`;
  const over = length - question.charLimit;
  return over > 0 ? `${withLimit} · ${count(over)} over the limit` : withLimit;
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

/** The questions of one application: GET-ed through the shared query layer (#152), saved whole with PUT. */
export const questionsPath = (applicationId: string) =>
  `/api/applications/${encodeURIComponent(applicationId)}/questions`;

export const coverLetterApi = {
  /** The questions in their saved order, fetched once (the delete dialog counts them). A missing application is a 404. */
  list: (applicationId: string) =>
    requestJson<{ questions: CoverLetterQuestion[] }>(questionsPath(applicationId)),
  /** Saves the whole list at once (#37): questions left out are deleted. */
  save: (applicationId: string, input: ReturnType<typeof toQuestionsInput>) =>
    requestJson<{ questions: CoverLetterQuestion[] }>(questionsPath(applicationId), {
      method: 'PUT',
      body: input,
    }),
};

/**
 * The questions of one application in their saved order, through the shared query layer (#152); a missing application
 * is a 404. A malformed id in the address (`valid` false) is reported on screen and never reaches the API.
 */
export function useQuestions(applicationId: string, valid: boolean) {
  return useApiQuery<{ questions: CoverLetterQuestion[] }>(
    apiKey(questionsPath(applicationId)),
    questionsPath(applicationId),
    { enabled: valid },
  );
}

/** One earlier question with its answer, and the application it was written for (#231). */
export type EarlierAnswer = {
  id: number;
  question: string;
  answer: string;
  applicationId: number;
  companyName: string;
  position: string | null;
  /** The day the application was added, YYYY-MM-DD. */
  date: string;
};

/** The earlier answers whose question or answer contains the text, leaving out the application being edited. */
const earlierAnswersPath = (text: string, applicationId: string) =>
  `/api/cover-letter-answers?q=${encodeURIComponent(text)}&exclude=${encodeURIComponent(applicationId)}`;

/** Earlier answers for the text last searched; nothing is fetched while the text is empty. */
export function useEarlierAnswers(text: string, applicationId: string) {
  const path = earlierAnswersPath(text, applicationId);
  return useApiQuery<{ matches: EarlierAnswer[] }>(apiKey(path), path, { enabled: text !== '' });
}
