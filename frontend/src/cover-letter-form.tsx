import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { applicationList, type ApplicationPaths } from './application-data';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import {
  answerLength,
  answerLengthText,
  coverLetterApi,
  maxQuestions,
  type QuestionDraft,
  questionFieldOf,
  questionsPath,
  toDraft,
  toQuestionsInput,
  typedLimit,
  useQuestions,
} from './cover-letter-data';
import { FindEarlierAnswers } from './cover-letter-earlier-answers';
import { invalidAddressText, isValidId } from './entity-id';
import { controlClass } from './form-fields';
import { useServerForm } from './form-state';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { useListQuery, useRefreshList } from './list-query';
import { BackLink, PageHeader } from './page-header';

const emptyDraft = (key: number): QuestionDraft => ({
  key,
  question: '',
  answer: '',
  charLimit: '',
});

function QuestionsForm({
  applicationId,
  initial,
  paths,
}: {
  applicationId: string;
  initial: QuestionDraft[];
  paths: ApplicationPaths;
}) {
  const navigate = useNavigate();
  const refresh = useRefreshList(questionsPath(applicationId));
  const [drafts, setDrafts] = useState(initial);
  const nextKey = useRef(initial.length);
  // The keys in the order the list was last sent, so the server's "Question 2" finds its question.
  const sentKeys = useRef<number[]>([]);
  const addButton = useRef<HTMLButtonElement>(null);
  const { fieldId, describe, errorFor, clearOnEdit, markDirty, submit, actions, pending } =
    useServerForm((path) => questionFieldOf(sentKeys.current)(path));
  const viewPath = paths.questions(applicationId);

  const update = (key: number, field: 'question' | 'answer' | 'charLimit', value: string) =>
    setDrafts((current) =>
      current.map((draft) => (draft.key === key ? { ...draft, [field]: value } : draft)),
    );

  const add = () => {
    markDirty();
    const key = nextKey.current++;
    setDrafts((current) => [...current, emptyDraft(key)]);
    requestAnimationFrame(() => document.getElementById(fieldId(`${key}:question`))?.focus());
  };

  const move = (key: number, by: -1 | 1) => {
    markDirty();
    const from = drafts.findIndex((draft) => draft.key === key);
    const to = from + by;
    if (to < 0 || to >= drafts.length) return;
    const next = [...drafts];
    [next[from], next[to]] = [next[to], next[from]];
    setDrafts(next);
    // Moving the card can drop focus; keep it on the same button, or the other one at either end.
    const direction = by < 0 ? 'up' : 'down';
    const atEnd = to === 0 || to === next.length - 1;
    const target = atEnd ? (direction === 'up' ? 'down' : 'up') : direction;
    requestAnimationFrame(() =>
      document.getElementById(`${fieldId(`${key}:question`)}-${target}`)?.focus(),
    );
  };

  const remove = (key: number) => {
    markDirty();
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  };

  const save = async () => {
    sentKeys.current = drafts.map((draft) => draft.key);
    await coverLetterApi.save(applicationId, toQuestionsInput(drafts));
    toast.success('Saved the questions');
    // The questions page shows the cached list: refetch it so it shows what was just saved.
    await refresh();
    void navigate(viewPath);
  };

  const full = drafts.length >= maxQuestions;
  // Positions whose answer is over the limit. Announced only when this changes, not on every key.
  const overLimit = drafts.flatMap((draft, index) => {
    const limit = typedLimit(draft.charLimit);
    return limit !== null && answerLength(draft.answer) > limit ? [index + 1] : [];
  });

  return (
    // The server checks every rule and answers in English, so the browser's own checks are off.
    <form
      noValidate
      onSubmit={submit(save)}
      onChange={clearOnEdit}
      className="flex max-w-3xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      {/* Locked while saving, so nothing typed after Save is left out of the request. */}
      <fieldset disabled={pending} className="m-0 flex min-w-0 flex-col gap-5 border-0 p-0">
        {drafts.length === 0 ? (
          <p className="text-body-sm break-keep text-muted-foreground">
            No questions. Choose Add question, or save to keep the application without questions.
          </p>
        ) : (
          <ol aria-label="Questions to save" className="flex flex-col gap-4">
            {drafts.map((draft, index) => {
              const field = (name: 'question' | 'charLimit' | 'answer') =>
                fieldId(`${draft.key}:${name}`);
              const countId = `${field('answer')}-count`;
              const limitHintId = `${field('charLimit')}-hint`;
              const limit = typedLimit(draft.charLimit);
              const over = limit !== null && answerLength(draft.answer) > limit;
              const titleId = `${field('question')}-title`;
              const text = draft.question.trim();
              // A question can be 500 characters; the dialog quotes the start of it.
              const name =
                text === ''
                  ? `Question ${String(index + 1)}`
                  : text.length > 60
                    ? `${text.slice(0, 60)}…`
                    : text;
              return (
                <li
                  key={draft.key}
                  aria-labelledby={titleId}
                  className="flex flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
                >
                  <h2 id={titleId} className="text-body font-semibold">
                    Question {index + 1}
                  </h2>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={field('question')}>Question</Label>
                    <textarea
                      id={field('question')}
                      rows={2}
                      maxLength={500}
                      className={cn(controlClass, 'min-h-16 py-2')}
                      value={draft.question}
                      onChange={(e) => update(draft.key, 'question', e.target.value)}
                      placeholder="e.g. Why do you want to join us?"
                      {...describe(`${draft.key}:question`)}
                    />
                    {errorFor(`${draft.key}:question`)}
                  </div>
                  <div className="flex flex-col gap-2 sm:max-w-xs">
                    <Label htmlFor={field('charLimit')}>Character limit</Label>
                    <Input
                      id={field('charLimit')}
                      inputMode="numeric"
                      autoComplete="off"
                      value={draft.charLimit}
                      onChange={(e) => update(draft.key, 'charLimit', e.target.value)}
                      placeholder="e.g. 1000"
                      {...describe(`${draft.key}:charLimit`, limitHintId)}
                    />
                    <p id={limitHintId} className="text-caption break-keep text-muted-foreground">
                      The posting&apos;s limit, spaces included. Leave it empty if there is none.
                    </p>
                    {errorFor(`${draft.key}:charLimit`)}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={field('answer')}>Answer</Label>
                    <textarea
                      id={field('answer')}
                      rows={8}
                      maxLength={5000}
                      className={cn(controlClass, 'min-h-40 py-2')}
                      value={draft.answer}
                      onChange={(e) => update(draft.key, 'answer', e.target.value)}
                      {...describe(`${draft.key}:answer`, countId)}
                    />
                    {/* #37: an answer over the limit is still saved; the count says by how much. */}
                    <p
                      id={countId}
                      className={cn(
                        'text-caption break-keep',
                        over ? 'font-medium text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      {answerLengthText({ answer: draft.answer, charLimit: limit })}
                      {over ? '. It can still be saved.' : ''}
                    </p>
                    {errorFor(`${draft.key}:answer`)}
                    <FindEarlierAnswers
                      applicationId={applicationId}
                      label={`question ${String(index + 1)}`}
                      onPick={(picked) => {
                        markDirty();
                        update(draft.key, 'answer', picked.slice(0, 5000));
                        requestAnimationFrame(() =>
                          document.getElementById(field('answer'))?.focus(),
                        );
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      id={`${field('question')}-up`}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      aria-label={`Move question ${String(index + 1)} up`}
                      onClick={() => move(draft.key, -1)}
                    >
                      <ArrowUp aria-hidden />
                      Up
                    </Button>
                    <Button
                      id={`${field('question')}-down`}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === drafts.length - 1}
                      aria-label={`Move question ${String(index + 1)} down`}
                      onClick={() => move(draft.key, 1)}
                    >
                      <ArrowDown aria-hidden />
                      Down
                    </Button>
                    <ConfirmDialog
                      title="Remove this question?"
                      description={
                        <span className="break-keep">
                          &apos;{name}&apos; and its answer leave the list. Nothing is deleted until
                          you save.
                        </span>
                      }
                      confirmLabel="Remove"
                      onConfirm={() => remove(draft.key)}
                      // The removed card's button is gone, so focus goes to Add question.
                      returnFocusRef={addButton}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`Remove question ${String(index + 1)}`}
                        >
                          <Trash2 aria-hidden />
                          Remove
                        </Button>
                      }
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex flex-col gap-2">
          <Button
            ref={addButton}
            type="button"
            variant="outline"
            className="w-fit"
            disabled={full}
            aria-describedby="question-count-hint"
            onClick={add}
          >
            <Plus aria-hidden />
            Add question
          </Button>
          <p id="question-count-hint" className="text-caption text-muted-foreground">
            {drafts.length} of {maxQuestions} questions. The order here is the saved order.
          </p>
        </div>
      </fieldset>
      <p aria-live="polite" className="sr-only">
        {overLimit.length
          ? `Over the character limit: question ${overLimit.join(', ')}. It can still be saved.`
          : ''}
      </p>
      {actions({ submitLabel: 'Save', cancelTo: viewPath })}
    </form>
  );
}

export function EditQuestions({ paths }: { paths: ApplicationPaths }) {
  const { id = '' } = useParams();
  const valid = isValidId(id);
  const questions = useQuestions(id, valid);
  // There is no single-item API (#36): the list is small, so the page finds its row there (the list screen's cache).
  const { rows: applications } = useListQuery(applicationList);
  const application = applications?.find((item) => String(item.id) === id);
  const loading = valid && questions.isPending;
  const missing = valid && questions.isError && questions.error.status === 404;
  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <BackLink to={paths.questions(id)} label="Questions" />
      <PageHeader
        title={application ? `Edit questions: ${application.companyName}` : 'Edit questions'}
        description="Write the questions and answers, put them in order, then save them all at once."
      />
      {!valid ? <Notice notice={{ kind: 'error', text: invalidAddressText }} /> : null}
      {/* Always mounted, so screen readers hear the text appear and go. */}
      <p role="status" className="sr-only">
        {loading ? 'Loading questions' : ''}
      </p>
      {loading ? <SkeletonList rows={3} /> : null}
      {missing ? (
        <Notice
          notice={{ kind: 'error', text: 'Application not found. It may already be deleted.' }}
        />
      ) : null}
      {valid && questions.isError && !missing && !questions.data ? (
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load the questions. ${errorText(questions.error)}`,
          }}
        />
      ) : null}
      {valid && questions.data ? (
        <QuestionsForm
          // A new id starts a fresh form instead of keeping the previous application's typing.
          key={id}
          applicationId={id}
          initial={questions.data.questions.map(toDraft)}
          paths={paths}
        />
      ) : null}
    </section>
  );
}
