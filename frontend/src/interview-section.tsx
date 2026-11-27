import { CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { NativeSelect } from './components/ui/native-select';
import { SkeletonList } from './components/ui/skeleton';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import {
  emptyInterviewForm,
  type Interview,
  interviewApi,
  interviewFieldOf,
  type InterviewForm,
  interviewFormatLabels,
  interviewFormats,
  interviewsPath,
  isUpcoming,
  nextRound,
  toInterviewForm,
  toInterviewInput,
  useInterviews,
} from './interview-data';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { useRefreshList } from './list-query';
import { formatDate, serviceToday } from './service-date';

// The interviews of one application (#230), on the application page: a list by date with an add and edit form in place.

function InterviewFields({
  applicationId,
  initial,
  id,
  onDone,
}: {
  applicationId: string;
  initial: InterviewForm;
  /** The interview being edited; none when adding. */
  id?: number;
  onDone: () => void;
}) {
  const refresh = useRefreshList(interviewsPath(applicationId));
  const [form, setForm] = useState(initial);
  const { fieldId, describe, errorFor, clearOnEdit, submit, pending } =
    useServerForm(interviewFieldOf);
  const set = (field: keyof InterviewForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  const setFormat = (value: string) => {
    const format = interviewFormats.find((item) => item === value);
    if (format) setForm((current) => ({ ...current, format }));
  };
  const save = async () => {
    // A date or time typed only in part reads as '' in the browser: send text the server refuses, so the message shows.
    const input = toInterviewInput({
      ...form,
      date: typedDate(
        document.getElementById(fieldId('date')) as HTMLInputElement | null,
        form.date,
      ),
      time: typedDate(
        document.getElementById(fieldId('time')) as HTMLInputElement | null,
        form.time,
      ),
    });
    await (id === undefined
      ? interviewApi.create(applicationId, input)
      : interviewApi.update(applicationId, id, input));
    await refresh();
    onDone();
  };
  const textarea = (field: 'questions' | 'retrospective', label: string, placeholder: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <textarea
        id={fieldId(field)}
        rows={4}
        maxLength={5000}
        className={cn(controlClass, 'min-h-24 py-2')}
        value={form[field]}
        onChange={(e) => set(field)(e.target.value)}
        placeholder={placeholder}
        {...describe(field)}
      />
      {errorFor(field)}
    </div>
  );
  return (
    <form
      noValidate
      onChange={clearOnEdit}
      onSubmit={submit(save)}
      aria-label={id === undefined ? 'Add interview' : 'Edit interview'}
      className="flex max-w-2xl flex-col gap-4 rounded-xl border bg-card p-4 text-card-foreground shadow-sm"
      aria-busy={pending || undefined}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('round')}>Round</Label>
          <Input
            id={fieldId('round')}
            inputMode="numeric"
            autoComplete="off"
            value={form.round}
            onChange={(e) => set('round')(e.target.value)}
            {...describe('round')}
          />
          {errorFor('round')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('format')}>Format</Label>
          <NativeSelect
            id={fieldId('format')}
            value={form.format}
            onChange={(e) => setFormat(e.target.value)}
            {...describe('format')}
          >
            {interviewFormats.map((value) => (
              <option key={value} value={value}>
                {interviewFormatLabels[value]}
              </option>
            ))}
          </NativeSelect>
          {errorFor('format')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('date')}>Date</Label>
          <Input
            id={fieldId('date')}
            type="date"
            value={form.date}
            onChange={(e) => set('date')(e.target.value)}
            {...describe('date')}
          />
          {errorFor('date')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('time')}>Time (Seoul)</Label>
          <Input
            id={fieldId('time')}
            type="time"
            value={form.time}
            onChange={(e) => set('time')(e.target.value)}
            {...describe('time')}
          />
          {errorFor('time')}
        </div>
      </div>
      {textarea('questions', 'Questions asked', 'Questions the interviewers asked')}
      {textarea('retrospective', 'Retrospective', 'What went well, what to do differently')}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {id === undefined ? 'Add interview' : 'Save interview'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function InterviewItem({
  applicationId,
  interview,
  today,
  onEdit,
}: {
  applicationId: string;
  interview: Interview;
  today: string;
  onEdit: () => void;
}) {
  const refresh = useRefreshList(interviewsPath(applicationId));
  const titleId = `interview-${interview.id}`;
  const upcoming = isUpcoming(interview, today);
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id={titleId} className="text-body font-semibold">
          Round {interview.round} · {interviewFormatLabels[interview.format]}
        </h3>
        <Badge variant={upcoming ? 'warning' : 'outline'}>{upcoming ? 'Upcoming' : 'Done'}</Badge>
      </div>
      <p className="text-body-sm text-muted-foreground">
        <time dateTime={`${interview.date}T${interview.time}`}>
          {formatDate(interview.date)} · {interview.time}
        </time>
      </p>
      {interview.questions ? (
        <div className="text-body-sm">
          <p className="text-caption font-medium text-muted-foreground">Questions asked</p>
          <p className="wrap-break-word break-keep whitespace-pre-line">{interview.questions}</p>
        </div>
      ) : null}
      {interview.retrospective ? (
        <div className="text-body-sm">
          <p className="text-caption font-medium text-muted-foreground">Retrospective</p>
          <p className="wrap-break-word break-keep whitespace-pre-line">
            {interview.retrospective}
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          aria-label={`Edit round ${String(interview.round)}`}
        >
          <Pencil aria-hidden />
          Edit
        </Button>
        <ConfirmDialog
          title="Delete this interview?"
          description={`Round ${String(interview.round)} on ${formatDate(interview.date)} will be deleted. This cannot be undone.`}
          onConfirm={async () => {
            await interviewApi.remove(applicationId, interview.id);
            await refresh();
          }}
          trigger={
            <Button
              variant="outline"
              size="sm"
              aria-label={`Delete round ${String(interview.round)}`}
            >
              <Trash2 aria-hidden />
              Delete
            </Button>
          }
        />
      </div>
    </li>
  );
}

export function InterviewSection({ applicationId }: { applicationId: string }) {
  const interviews = useInterviews(applicationId, true);
  // 'new', an interview id being edited, or none.
  const [editing, setEditing] = useState<'new' | number>();
  const list = interviews.data?.interviews ?? [];
  const today = serviceToday();
  const editedItem =
    typeof editing === 'number' ? list.find((item) => item.id === editing) : undefined;
  return (
    <section aria-labelledby="interviews-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="interviews-title" className="text-body font-semibold">
          Interviews
        </h2>
        {editing === undefined && interviews.data ? (
          <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
            <Plus aria-hidden />
            Add interview
          </Button>
        ) : null}
      </div>
      {interviews.isPending ? <SkeletonList rows={2} /> : null}
      {interviews.isError ? (
        <p role="alert" className="text-body-sm text-destructive">
          Could not load the interviews. {errorText(interviews.error)}
        </p>
      ) : null}
      {editing === 'new' ? (
        <InterviewFields
          applicationId={applicationId}
          initial={{ ...emptyInterviewForm, round: nextRound(list) }}
          onDone={() => setEditing(undefined)}
        />
      ) : null}
      {editedItem ? (
        <InterviewFields
          key={editedItem.id}
          applicationId={applicationId}
          id={editedItem.id}
          initial={toInterviewForm(editedItem)}
          onDone={() => setEditing(undefined)}
        />
      ) : null}
      {interviews.data && list.length === 0 && editing === undefined ? (
        <EmptyState
          className="break-keep"
          icon={<CalendarClock />}
          title="No interviews yet"
          description="Choose Add interview to record the date, the questions and what you learned."
        />
      ) : null}
      {list.length > 0 ? (
        <ol
          aria-label="Interview list"
          className="flex max-w-2xl flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {list.map((interview) => (
            <InterviewItem
              key={interview.id}
              applicationId={applicationId}
              interview={interview}
              today={today}
              onEdit={() => {
                setEditing(interview.id);
              }}
            />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
