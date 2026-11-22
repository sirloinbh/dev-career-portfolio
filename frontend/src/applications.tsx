import { FileText, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  type Application,
  applicationApi,
  applicationFieldErrors,
  type ApplicationForm,
  type ApplicationPaths,
  applicationStatuses,
  applicationStatusLabels,
  applicationStatusVariant,
  deadlineText,
  emptyApplicationForm,
  toApplicationForm,
  toApplicationInput,
} from './application-data';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { EmptyState } from './components/ui/empty-state';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { coverLetterApi } from './cover-letter-data';
import { deleteItem } from './delete-item';
import { entryCount } from './entry-count';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import { ReloadNotice } from './item-list-page-notice';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { OutLink } from './out-link';
import { BackLink, PageHeader } from './page-header';
import { serviceToday } from './service-date';
import { TextBlocks } from './text-blocks';
import { useLoad, useReloading } from './use-load';
import { webLink } from './web-link';

const loadApplications = () => applicationApi.list();

function ApplicationItem({
  application,
  today,
  paths,
  onDelete,
}: {
  application: Application;
  today: string;
  paths: ApplicationPaths;
  onDelete: (application: Application) => Promise<void>;
}) {
  const titleId = `application-${application.id}`;
  const posting = webLink(application.postingUrl);
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h2 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {application.companyName}
        </h2>
        <Badge variant={applicationStatusVariant[application.status]}>
          {applicationStatusLabels[application.status]}
        </Badge>
      </div>
      {application.position ? (
        <p className="text-body-sm wrap-anywhere break-keep">{application.position}</p>
      ) : null}
      <p className="text-body-sm text-muted-foreground">{deadlineText(application, today)}</p>
      <TextBlocks entries={[['Notes', application.memo]]} />
      {posting ? (
        <div className="flex flex-wrap gap-x-4">
          <OutLink href={posting} label="Job posting" owner={application.companyName} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link
            to={paths.questions(application.id)}
            aria-label={`Cover letter questions for ${application.companyName}`}
          >
            <ListOrdered aria-hidden />
            Questions
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(application.id)} aria-label={`Edit ${application.companyName}`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <DeleteApplication application={application} onDelete={onDelete} />
      </div>
    </li>
  );
}

/** What the delete dialog says about the questions, once it knows how many there are. */
function deleteText(name: string, questions: number | undefined) {
  if (questions === 0) return `'${name}' will be deleted. It has no cover letter questions.`;
  if (questions === undefined) return `'${name}' and its cover letter questions will be deleted.`;
  return `'${name}' and its ${String(questions)} cover letter ${
    questions === 1 ? 'question' : 'questions'
  } will be deleted.`;
}

function DeleteApplication({
  application,
  onDelete,
}: {
  application: Application;
  onDelete: (application: Application) => Promise<void>;
}) {
  // #51: the questions go with the application (#37 ON DELETE CASCADE), so the dialog counts them when
  // it opens. Until the count arrives, or if it cannot be read, it says so without a number.
  const [questions, setQuestions] = useState<number>();
  // Only the latest opening's answer counts: a slow one from an earlier opening is ignored.
  const request = useRef(0);
  const count = (open: boolean) => {
    const current = ++request.current;
    // Closing keeps the text, so the number does not vanish while the dialog fades out.
    if (!open) return;
    setQuestions(undefined);
    coverLetterApi.list(String(application.id)).then(
      ({ questions: list }) => {
        if (current === request.current) setQuestions(list.length);
      },
      () => undefined,
    );
  };
  return (
    <ConfirmDialog
      title="Delete this application?"
      description={
        <span className="break-keep">
          {deleteText(application.companyName, questions)} This cannot be undone.
        </span>
      }
      onOpenChange={count}
      onConfirm={() => onDelete(application)}
      trigger={
        <Button variant="outline" size="sm" aria-label={`Delete ${application.companyName}`}>
          <Trash2 aria-hidden />
          Delete
        </Button>
      }
    />
  );
}

export function ApplicationList({ paths }: { paths: ApplicationPaths }) {
  const { loaded, data, reload } = useReloading('all', loadApplications);
  const applications = data?.applications ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a reload keeps the rows on screen.
  const firstLoad = loaded.state === 'loading' && data === undefined;
  // Read once per render: the countdown follows the service date, not the device's time zone.
  const today = serviceToday();

  const remove = async (application: Application) => {
    await deleteItem({
      remove: () => applicationApi.remove(application.id),
      noun: 'application',
      name: application.companyName,
    });
    reload((current) => ({
      applications: current.applications.filter((item) => item.id !== application.id),
    }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Cover letters"
        description="See the companies you applied to by status (drafting, submitted, closed), earliest deadline first within each status. Drafts past their deadline come after the other drafts."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading applications' : ''}
          {data ? entryCount(applications.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          Add application
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load applications. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'error' && data !== undefined ? (
        <ReloadNotice noun="applications" error={loaded.error} onRetry={() => reload()} />
      ) : null}
      {data && applications.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<FileText />}
          title="No applications added yet"
          description="Choose Add application and it will appear here by status and deadline."
        />
      ) : null}
      {applications.length > 0 ? (
        <ul
          aria-label="Application list"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {applications.map((application) => (
            <ApplicationItem
              key={application.id}
              application={application}
              today={today}
              paths={paths}
              onDelete={remove}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ApplicationFields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: ApplicationForm;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: ApplicationForm) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const deadlineInput = useRef<HTMLInputElement>(null);
  const { fieldId, describe, errorFor, submit, actions, pending } =
    useServerForm(applicationFieldErrors);
  const set = (field: Exclude<keyof ApplicationForm, 'status'>) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));
  // Only one of the three values is kept, so the status stays typed instead of any string.
  const setStatus = (value: string) => {
    const status = applicationStatuses.find((item) => item === value);
    if (status) setForm((current) => ({ ...current, status }));
  };

  /** A one-line text input with its label and the server's message about it. */
  const textField = (
    field: 'companyName' | 'position' | 'postingUrl',
    label: string,
    placeholder: string,
    maxLength: number,
    type = 'text',
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <Input
        id={fieldId(field)}
        type={type}
        maxLength={maxLength}
        autoComplete="off"
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
        onSubmit({ ...form, deadline: typedDate(deadlineInput.current, form.deadline) }),
      )}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      {textField('companyName', 'Company name', 'e.g. Hanbit Soft', 100)}
      {textField('position', 'Position', 'e.g. Backend developer', 100)}
      {textField(
        'postingUrl',
        'Job posting link',
        'e.g. https://careers.example.com/jobs/12',
        500,
        'url',
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('deadline')}>Deadline</Label>
          <Input
            id={fieldId('deadline')}
            ref={deadlineInput}
            type="date"
            value={form.deadline}
            onChange={(e) => set('deadline')(e.target.value)}
            {...describe('deadline', `${fieldId('deadline')}-hint`)}
          />
          {/* #36: an empty deadline is how an application without one is saved. */}
          <p
            id={`${fieldId('deadline')}-hint`}
            className="text-caption break-keep text-muted-foreground"
          >
            Leave it empty if there is no deadline. The list shows &quot;No deadline&quot;.
          </p>
          {errorFor('deadline')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('status')}>Status</Label>
          <select
            id={fieldId('status')}
            className={cn(controlClass, 'h-9')}
            value={form.status}
            onChange={(e) => setStatus(e.target.value)}
            {...describe('status')}
          >
            {applicationStatuses.map((value) => (
              <option key={value} value={value}>
                {applicationStatusLabels[value]}
              </option>
            ))}
          </select>
          {errorFor('status')}
        </div>
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
          placeholder="Interview stages, contacts, and other notes"
          {...describe('memo')}
        />
        {errorFor('memo')}
      </div>
      {actions({ submitLabel, cancelTo })}
    </form>
  );
}

export function NewApplication({ paths }: { paths: ApplicationPaths }) {
  const navigate = useNavigate();
  const create = async (form: ApplicationForm) => {
    const { application } = await applicationApi.create(toApplicationInput(form));
    toast.success(`Added '${application.companyName}'`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="Application list" />
      <PageHeader
        title="Add application"
        description="Company name and status are all you need. The rest can stay empty."
      />
      <ApplicationFields
        initial={emptyApplicationForm}
        submitLabel="Add"
        cancelTo={paths.list}
        onSubmit={create}
      />
    </section>
  );
}

export function EditApplication({ paths }: { paths: ApplicationPaths }) {
  const { id = '' } = useParams();
  // There is no single-item API (#36): the list is small, so the form finds its row there.
  const loaded = useLoad('all', loadApplications);
  const navigate = useNavigate();
  const application =
    loaded.state === 'ok'
      ? loaded.data.applications.find((item) => String(item.id) === id)
      : undefined;
  const update = async (form: ApplicationForm) => {
    await applicationApi.update(Number(id), toApplicationInput(form));
    toast.success('Saved');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="Application list" />
      <PageHeader title="Edit application" description="Change what you need, then save." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load applications. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'ok' && !application ? (
        <Notice
          notice={{ kind: 'error', text: 'Application not found. It may already be deleted.' }}
        />
      ) : null}
      {application ? (
        <ApplicationFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={application.id}
          initial={toApplicationForm(application)}
          submitLabel="Save"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
