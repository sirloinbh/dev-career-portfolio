import { toNumber } from './form-fields';
import { flatFieldOf } from './form-state';
import { requestJson } from './lib/api';
import { apiKey, useApiQuery } from './lib/query';

// Interviews of one application (#230): API calls and display rules. The section is in interview-section.tsx.
// `date` is YYYY-MM-DD and `time` is HH:MM, both in the service time zone (Asia/Seoul).

export const interviewFormats = ['phone', 'video', 'onsite'] as const;
export type InterviewFormat = (typeof interviewFormats)[number];

export const interviewFormatLabels: Record<InterviewFormat, string> = {
  phone: 'Phone',
  video: 'Video call',
  onsite: 'On site',
};

export type Interview = {
  id: number;
  round: number;
  date: string;
  time: string;
  format: InterviewFormat;
  questions: string | null;
  retrospective: string | null;
};

/** The form keeps every field as the text in its input. */
export type InterviewForm = {
  round: string;
  date: string;
  time: string;
  format: InterviewFormat;
  questions: string;
  retrospective: string;
};

export const emptyInterviewForm: InterviewForm = {
  round: '1',
  date: '',
  time: '',
  format: 'video',
  questions: '',
  retrospective: '',
};

/** The next round number after the interviews already saved (at most the server's limit of 20). */
export const nextRound = (interviews: readonly Interview[]) =>
  String(Math.min(20, Math.max(0, ...interviews.map((item) => item.round)) + 1));

export const toInterviewForm = (interview: Interview): InterviewForm => ({
  round: String(interview.round),
  date: interview.date,
  time: interview.time,
  format: interview.format,
  questions: interview.questions ?? '',
  retrospective: interview.retrospective ?? '',
});

/** The body the API takes. Round text that is not a number goes as it is so the server explains. */
export const toInterviewInput = (form: InterviewForm) => ({ ...form, round: toNumber(form.round) });

/** The form field a server validation path names. */
export const interviewFieldOf = flatFieldOf(emptyInterviewForm);

/** Whether the interview day has not passed yet (today counts as upcoming). */
export const isUpcoming = (interview: Pick<Interview, 'date'>, today: string) =>
  interview.date >= today;

export const interviewsPath = (applicationId: string) =>
  `/api/applications/${encodeURIComponent(applicationId)}/interviews`;

export const interviewApi = {
  create: (applicationId: string, input: ReturnType<typeof toInterviewInput>) =>
    requestJson<{ interview: Interview }>(interviewsPath(applicationId), {
      method: 'POST',
      body: input,
    }),
  update: (applicationId: string, id: number, input: ReturnType<typeof toInterviewInput>) =>
    requestJson<{ interview: Interview }>(`${interviewsPath(applicationId)}/${String(id)}`, {
      method: 'PUT',
      body: input,
    }),
  remove: (applicationId: string, id: number) =>
    requestJson<undefined>(`${interviewsPath(applicationId)}/${String(id)}`, { method: 'DELETE' }),
};

/** The interviews of one application in date order, through the shared query layer. */
export function useInterviews(applicationId: string, enabled: boolean) {
  return useApiQuery<{ interviews: Interview[] }>(
    apiKey(interviewsPath(applicationId)),
    interviewsPath(applicationId),
    { enabled },
  );
}
