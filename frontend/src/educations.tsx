import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { deleteItem } from './delete-item';
import {
  degreeLabels,
  degrees,
  type Education,
  educationApi,
  type EducationForm,
  type EducationPaths,
  emptyEducationForm,
  fieldErrors,
  gpaText,
  periodText,
  statuses,
  statusLabels,
  toEducationForm,
  toEducationInput,
} from './education-data';
import { entryCount } from './entry-count';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { BackLink, PageHeader } from './page-header';
import { useLoad, useReloading } from './use-load';

const loadEducations = () => educationApi.list();

function EducationItem({
  education,
  paths,
  onDelete,
}: {
  education: Education;
  paths: EducationPaths;
  onDelete: (education: Education) => Promise<void>;
}) {
  const gpa = gpaText(education);
  const titleId = `education-${education.id}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h2 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {education.school}
        </h2>
        <Badge variant={education.status === 'enrolled' ? 'default' : 'secondary'}>
          {statusLabels[education.status]}
        </Badge>
      </div>
      <p className="text-body-sm wrap-break-word break-keep">
        {degreeLabels[education.degree]}
        {education.major ? ` · ${education.major}` : ''}
      </p>
      {/* The period is the main fact of an education, so body size rather than text-meta (13px floor). */}
      <p className="text-body-sm text-muted-foreground">
        {periodText(education)}
        {gpa ? ` · ${gpa}` : ''}
      </p>
      {education.memo ? (
        <p className="text-caption wrap-break-word break-keep whitespace-pre-line text-muted-foreground">
          {education.memo}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(education.id)} aria-label={`Edit ${education.school}`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <ConfirmDialog
          title="Delete this education?"
          description={
            <span className="break-keep">
              &apos;{education.school}&apos; will be deleted. This cannot be undone.
            </span>
          }
          onConfirm={() => onDelete(education)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`Delete ${education.school}`}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          }
        />
      </div>
    </li>
  );
}

export function EducationList({ paths }: { paths: EducationPaths }) {
  const { loaded, data, reload } = useReloading('all', loadEducations);
  const educations = data?.educations ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a reload keeps the rows on screen.
  const firstLoad = loaded.state === 'loading' && data === undefined;

  const remove = async (education: Education) => {
    await deleteItem({
      remove: () => educationApi.remove(education.id),
      noun: 'education',
      name: education.school,
    });
    reload((current) => ({
      educations: current.educations.filter((item) => item.id !== education.id),
    }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Education"
        description="See your schools, majors, and study periods, newest enrollment first."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading education' : ''}
          {data ? entryCount(educations.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          Add education
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `Could not load education. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {data && educations.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<GraduationCap />}
          title="No education added yet"
          description="Choose Add education and it will appear here, newest enrollment first."
        />
      ) : null}
      {educations.length > 0 ? (
        <ul
          aria-label="Education list"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {educations.map((education) => (
            <EducationItem
              key={education.id}
              education={education}
              paths={paths}
              onDelete={remove}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EducationFields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: EducationForm;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: EducationForm) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const endDateInput = useRef<HTMLInputElement>(null);
  const { fieldId, describe, errorFor, clearError, submit, actions, pending } =
    useServerForm(fieldErrors);
  const set = (field: keyof EducationForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  const enrolled = form.status === 'enrolled';
  return (
    // The server checks every rule and answers in English, so the browser's own checks are off.
    <form
      noValidate
      onSubmit={submit(() =>
        onSubmit({ ...form, endDate: typedDate(endDateInput.current, form.endDate) }),
      )}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('school')}>School</Label>
        <Input
          id={fieldId('school')}
          maxLength={100}
          autoComplete="off"
          value={form.school}
          onChange={(e) => set('school')(e.target.value)}
          placeholder="e.g. Hanguk University"
          {...describe('school')}
        />
        {errorFor('school')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('major')}>Major</Label>
        <Input
          id={fieldId('major')}
          maxLength={100}
          autoComplete="off"
          value={form.major}
          onChange={(e) => set('major')(e.target.value)}
          placeholder="e.g. Computer Science"
          {...describe('major')}
        />
        {errorFor('major')}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('degree')}>Degree</Label>
          <select
            id={fieldId('degree')}
            className={cn(controlClass, 'h-9')}
            value={form.degree}
            onChange={(e) => set('degree')(e.target.value)}
            {...describe('degree')}
          >
            {degrees.map((value) => (
              <option key={value} value={value}>
                {degreeLabels[value]}
              </option>
            ))}
          </select>
          {errorFor('degree')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('status')}>Status</Label>
          <select
            id={fieldId('status')}
            className={cn(controlClass, 'h-9')}
            value={form.status}
            // Enrolled has no graduation date yet, so the date (and any message about it) is cleared
            // rather than sent and refused.
            onChange={(e) => {
              const enrolledNow = e.target.value === 'enrolled';
              setForm((current) => ({
                ...current,
                status: e.target.value as EducationForm['status'],
                endDate: enrolledNow ? '' : current.endDate,
              }));
              if (enrolledNow) {
                clearError('endDate');
                // A half-typed date reads as '' already, so React leaves the input alone; clear it here.
                if (endDateInput.current) endDateInput.current.value = '';
              }
            }}
            {...describe('status')}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
          {errorFor('status')}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('startDate')}>Enrollment date</Label>
          <Input
            id={fieldId('startDate')}
            type="date"
            value={form.startDate}
            onChange={(e) => set('startDate')(e.target.value)}
            {...describe('startDate')}
          />
          {errorFor('startDate')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('endDate')}>Graduation date</Label>
          <Input
            id={fieldId('endDate')}
            ref={endDateInput}
            type="date"
            disabled={enrolled}
            value={form.endDate}
            onChange={(e) => set('endDate')(e.target.value)}
            {...describe('endDate', `${fieldId('endDate')}-hint`)}
          />
          <p
            id={`${fieldId('endDate')}-hint`}
            className="text-caption break-keep text-muted-foreground"
          >
            {enrolled
              ? 'Leave the graduation date empty while enrolled.'
              : 'Leave it empty if a leave or withdrawal has no set date.'}
          </p>
          {errorFor('endDate')}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('gpa')}>GPA</Label>
          <Input
            id={fieldId('gpa')}
            // Text, not type="number": a number input empties text it cannot read ("3..5"), so the
            // server would never see it and explain in English.
            inputMode="decimal"
            autoComplete="off"
            value={form.gpa}
            onChange={(e) => set('gpa')(e.target.value)}
            placeholder="e.g. 3.75"
            {...describe('gpa', `${fieldId('gpa')}-hint`)}
          />
          {errorFor('gpa')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('gpaScale')}>Maximum GPA</Label>
          <Input
            id={fieldId('gpaScale')}
            inputMode="decimal"
            autoComplete="off"
            value={form.gpaScale}
            onChange={(e) => set('gpaScale')(e.target.value)}
            placeholder="e.g. 4.5"
            {...describe('gpaScale', `${fieldId('gpa')}-hint`)}
          />
          {errorFor('gpaScale')}
        </div>
        <p
          id={`${fieldId('gpa')}-hint`}
          className="text-caption break-keep text-muted-foreground sm:col-span-2"
        >
          Enter the GPA and maximum GPA together, or leave both empty. Up to two decimal places.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('memo')}>Notes</Label>
        <textarea
          id={fieldId('memo')}
          rows={4}
          maxLength={2000}
          className={cn(controlClass, 'min-h-24 py-2')}
          value={form.memo}
          onChange={(e) => set('memo')(e.target.value)}
          placeholder="Capstone project, awards, thesis, etc."
          {...describe('memo')}
        />
        {errorFor('memo')}
      </div>
      {actions({ submitLabel, cancelTo })}
    </form>
  );
}

export function NewEducation({ paths }: { paths: EducationPaths }) {
  const navigate = useNavigate();
  const create = async (form: EducationForm) => {
    const { education } = await educationApi.create(toEducationInput(form));
    toast.success(`Added '${education.school}'`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="Education list" />
      <PageHeader
        title="Add education"
        description="School, degree, status, and enrollment date are all you need. The rest can stay empty."
      />
      <EducationFields
        initial={emptyEducationForm}
        submitLabel="Add"
        cancelTo={paths.list}
        onSubmit={create}
      />
    </section>
  );
}

export function EditEducation({ paths }: { paths: EducationPaths }) {
  const { id = '' } = useParams();
  // There is no single-item API (#31): the list is small, so the form finds its row there.
  const loaded = useLoad('all', loadEducations);
  const navigate = useNavigate();
  const education =
    loaded.state === 'ok'
      ? loaded.data.educations.find((item) => String(item.id) === id)
      : undefined;
  const update = async (form: EducationForm) => {
    await educationApi.update(Number(id), toEducationInput(form));
    toast.success('Saved');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="Education list" />
      <PageHeader title="Edit education" description="Change what you need, then save." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: `Could not load education. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && !education ? (
        <Notice
          notice={{ kind: 'error', text: 'Education not found. It may already be deleted.' }}
        />
      ) : null}
      {education ? (
        <EducationFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={education.id}
          initial={toEducationForm(education)}
          submitLabel="Save"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
