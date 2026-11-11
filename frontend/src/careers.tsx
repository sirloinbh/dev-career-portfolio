import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  type Career,
  careerApi,
  careerFieldErrors,
  type CareerForm,
  type CareerPaths,
  careerPeriodText,
  employmentTypeLabels,
  employmentTypes,
  emptyCareerForm,
  isCurrent,
  roleText,
  toCareerForm,
  toCareerInput,
} from './career-data';
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
import { entryCount } from './entry-count';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { BackLink, PageHeader } from './page-header';
import { TextBlocks } from './text-blocks';
import { useLoad, useReloading } from './use-load';

const loadCareers = () => careerApi.list();

function CareerItem({
  career,
  paths,
  onDelete,
}: {
  career: Career;
  paths: CareerPaths;
  onDelete: (career: Career) => Promise<void>;
}) {
  const titleId = `career-${career.id}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h2 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {career.company}
        </h2>
        {isCurrent(career) ? <Badge>Current</Badge> : null}
      </div>
      <p className="text-body-sm wrap-break-word break-keep">{roleText(career)}</p>
      {/* The period is the main fact of a career, so body size rather than text-meta (13px floor). */}
      <p className="text-body-sm text-muted-foreground">{careerPeriodText(career)}</p>
      <TextBlocks
        entries={[
          ['Duties', career.duties],
          ['Achievements', career.achievements],
        ]}
      />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(career.id)} aria-label={`Edit ${career.company}`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <ConfirmDialog
          title="Delete this career?"
          description={
            <span className="break-keep">
              &apos;{career.company}&apos; will be deleted. This cannot be undone.
            </span>
          }
          onConfirm={() => onDelete(career)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`Delete ${career.company}`}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          }
        />
      </div>
    </li>
  );
}

export function CareerList({ paths }: { paths: CareerPaths }) {
  const { loaded, data, reload } = useReloading('all', loadCareers);
  const careers = data?.careers ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a reload keeps the rows on screen.
  const firstLoad = loaded.state === 'loading' && data === undefined;

  const remove = async (career: Career) => {
    await deleteItem({
      remove: () => careerApi.remove(career.id),
      noun: 'career',
      name: career.company,
    });
    reload((current) => ({ careers: current.careers.filter((item) => item.id !== career.id) }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Career"
        description="See your employers and roles, newest start first."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading career' : ''}
          {data ? entryCount(careers.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          Add career
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `Could not load career. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {data && careers.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Briefcase />}
          title="No career added yet"
          description="Choose Add career and it will appear here, newest start first."
        />
      ) : null}
      {careers.length > 0 ? (
        <ul
          aria-label="Career list"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {careers.map((career) => (
            <CareerItem key={career.id} career={career} paths={paths} onDelete={remove} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function CareerFields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: CareerForm;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: CareerForm) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const endDateInput = useRef<HTMLInputElement>(null);
  const { fieldId, describe, errorFor, submit, actions, pending } =
    useServerForm(careerFieldErrors);
  const set = (field: keyof CareerForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** A one-line text input with its label and the server's message about it. */
  const textField = (field: keyof CareerForm, label: string, placeholder: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <Input
        id={fieldId(field)}
        maxLength={100}
        autoComplete="off"
        value={form[field]}
        onChange={(e) => set(field)(e.target.value)}
        placeholder={placeholder}
        {...describe(field)}
      />
      {errorFor(field)}
    </div>
  );

  /** A multi-line text area for duties and achievements. */
  const longField = (field: keyof CareerForm, label: string, placeholder: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <textarea
        id={fieldId(field)}
        rows={4}
        maxLength={2000}
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
    // The server checks every rule and answers in English, so the browser's own checks are off.
    <form
      noValidate
      onSubmit={submit(() =>
        onSubmit({ ...form, endDate: typedDate(endDateInput.current, form.endDate) }),
      )}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      {textField('company', 'Company', 'e.g. Hanbit Soft')}
      <div className="grid gap-5 sm:grid-cols-2">
        {textField('department', 'Department', 'e.g. Platform team')}
        {textField('position', 'Job title', 'e.g. Senior developer')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('employmentType')}>Employment type</Label>
        <select
          id={fieldId('employmentType')}
          className={cn(controlClass, 'h-9 sm:max-w-xs')}
          value={form.employmentType}
          onChange={(e) => set('employmentType')(e.target.value)}
          {...describe('employmentType')}
        >
          {employmentTypes.map((value) => (
            <option key={value} value={value}>
              {employmentTypeLabels[value]}
            </option>
          ))}
        </select>
        {errorFor('employmentType')}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('startDate')}>Start date</Label>
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
          <Label htmlFor={fieldId('endDate')}>End date</Label>
          <Input
            id={fieldId('endDate')}
            ref={endDateInput}
            type="date"
            value={form.endDate}
            onChange={(e) => set('endDate')(e.target.value)}
            {...describe('endDate', `${fieldId('endDate')}-hint`)}
          />
          {/* #32: an empty end date is how a job still held is saved; there is no status field. */}
          <p
            id={`${fieldId('endDate')}-hint`}
            className="text-caption break-keep text-muted-foreground"
          >
            Leave it empty if you still work here. The list shows &quot;Current&quot;.
          </p>
          {errorFor('endDate')}
        </div>
      </div>
      {longField('duties', 'Duties', 'Services, role, and technologies used')}
      {longField('achievements', 'Achievements', 'Results you can state in numbers')}
      {actions({ submitLabel, cancelTo })}
    </form>
  );
}

export function NewCareer({ paths }: { paths: CareerPaths }) {
  const navigate = useNavigate();
  const create = async (form: CareerForm) => {
    const { career } = await careerApi.create(toCareerInput(form));
    toast.success(`Added '${career.company}'`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="Career list" />
      <PageHeader
        title="Add career"
        description="Company, employment type, and start date are all you need. The rest can stay empty."
      />
      <CareerFields
        initial={emptyCareerForm}
        submitLabel="Add"
        cancelTo={paths.list}
        onSubmit={create}
      />
    </section>
  );
}

export function EditCareer({ paths }: { paths: CareerPaths }) {
  const { id = '' } = useParams();
  // There is no single-item API (#32): the list is small, so the form finds its row there.
  const loaded = useLoad('all', loadCareers);
  const navigate = useNavigate();
  const career =
    loaded.state === 'ok' ? loaded.data.careers.find((item) => String(item.id) === id) : undefined;
  const update = async (form: CareerForm) => {
    await careerApi.update(Number(id), toCareerInput(form));
    toast.success('Saved');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="Career list" />
      <PageHeader title="Edit career" description="Change what you need, then save." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: `Could not load career. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && !career ? (
        <Notice notice={{ kind: 'error', text: 'Career not found. It may already be deleted.' }} />
      ) : null}
      {career ? (
        <CareerFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={career.id}
          initial={toCareerForm(career)}
          submitLabel="Save"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
