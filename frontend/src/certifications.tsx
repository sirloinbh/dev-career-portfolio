import { Award, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  type Certification,
  certificationApi,
  certificationFieldErrors,
  type CertificationForm,
  type CertificationPaths,
  certificationPeriodText,
  emptyCertificationForm,
  isExpired,
  issuerText,
  toCertificationForm,
  toCertificationInput,
} from './certification-data';
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
import { serviceToday } from './service-date';
import { TextBlocks } from './text-blocks';
import { useLoad, useReloading } from './use-load';

const loadCertifications = () => certificationApi.list();

function CertificationItem({
  certification,
  today,
  paths,
  onDelete,
}: {
  certification: Certification;
  today: string;
  paths: CertificationPaths;
  onDelete: (certification: Certification) => Promise<void>;
}) {
  const titleId = `certification-${certification.id}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h2 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {certification.name}
        </h2>
        {/* A word, not a colour: an expired certification stays in the list as part of the record. */}
        {isExpired(certification, today) ? <Badge variant="outline">Expired</Badge> : null}
      </div>
      <p className="text-body-sm wrap-anywhere break-keep">{issuerText(certification)}</p>
      <p className="text-body-sm text-muted-foreground">{certificationPeriodText(certification)}</p>
      <TextBlocks entries={[['Notes', certification.memo]]} />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(certification.id)} aria-label={`Edit ${certification.name}`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <ConfirmDialog
          title="Delete this certification?"
          description={
            <span className="break-keep">
              &apos;{certification.name}&apos; will be deleted. This cannot be undone.
            </span>
          }
          onConfirm={() => onDelete(certification)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`Delete ${certification.name}`}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          }
        />
      </div>
    </li>
  );
}

export function CertificationList({ paths }: { paths: CertificationPaths }) {
  const { loaded, data, reload } = useReloading('all', loadCertifications);
  const certifications = data?.certifications ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a reload keeps the rows on screen.
  const firstLoad = loaded.state === 'loading' && data === undefined;
  // Read once per render: the badge follows the service date, not the device's time zone.
  const today = serviceToday();

  const remove = async (certification: Certification) => {
    await deleteItem({
      remove: () => certificationApi.remove(certification.id),
      noun: 'certification',
      name: certification.name,
    });
    reload((current) => ({
      certifications: current.certifications.filter((item) => item.id !== certification.id),
    }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Certifications"
        description="See your certifications and exam results, newest first."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading certifications' : ''}
          {data ? entryCount(certifications.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          Add certification
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load certifications. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {data && certifications.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Award />}
          title="No certifications added yet"
          description="Choose Add certification and it will appear here, newest first."
        />
      ) : null}
      {certifications.length > 0 ? (
        <ul
          aria-label="Certification list"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {certifications.map((certification) => (
            <CertificationItem
              key={certification.id}
              certification={certification}
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

function CertificationFields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: CertificationForm;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: CertificationForm) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const expiryDateInput = useRef<HTMLInputElement>(null);
  const { fieldId, describe, errorFor, submit, actions, pending } =
    useServerForm(certificationFieldErrors);
  const set = (field: keyof CertificationForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** A one-line text input with its label and the server's message about it. */
  const textField = (
    field: keyof CertificationForm,
    label: string,
    placeholder: string,
    maxLength: number,
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <Input
        id={fieldId(field)}
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
        onSubmit({ ...form, expiryDate: typedDate(expiryDateInput.current, form.expiryDate) }),
      )}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      {textField('name', 'Certification name', 'e.g. Engineer Information Processing', 100)}
      {textField('issuer', 'Issuer', 'e.g. Human Resources Development Service', 100)}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('acquiredDate')}>Date earned</Label>
          <Input
            id={fieldId('acquiredDate')}
            type="date"
            value={form.acquiredDate}
            onChange={(e) => set('acquiredDate')(e.target.value)}
            {...describe('acquiredDate')}
          />
          {errorFor('acquiredDate')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('expiryDate')}>Expiry date</Label>
          <Input
            id={fieldId('expiryDate')}
            ref={expiryDateInput}
            type="date"
            value={form.expiryDate}
            onChange={(e) => set('expiryDate')(e.target.value)}
            {...describe('expiryDate', `${fieldId('expiryDate')}-hint`)}
          />
          {/* #35: an empty expiry date is how a certification that never expires is saved. */}
          <p
            id={`${fieldId('expiryDate')}-hint`}
            className="text-caption break-keep text-muted-foreground"
          >
            Leave it empty if the certification does not expire. The list shows &quot;No
            expiry&quot;.
          </p>
          {errorFor('expiryDate')}
        </div>
      </div>
      <div className="sm:max-w-xs">
        {textField('score', 'Score or grade', 'e.g. 905, Grade 1, IH', 50)}
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
          placeholder="Renewal plans, exam subjects, and other notes"
          {...describe('memo')}
        />
        {errorFor('memo')}
      </div>
      {actions({ submitLabel, cancelTo })}
    </form>
  );
}

export function NewCertification({ paths }: { paths: CertificationPaths }) {
  const navigate = useNavigate();
  const create = async (form: CertificationForm) => {
    const { certification } = await certificationApi.create(toCertificationInput(form));
    toast.success(`Added '${certification.name}'`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="Certification list" />
      <PageHeader
        title="Add certification"
        description="Certification name, issuer, and date earned are all you need. The rest can stay empty."
      />
      <CertificationFields
        initial={emptyCertificationForm}
        submitLabel="Add"
        cancelTo={paths.list}
        onSubmit={create}
      />
    </section>
  );
}

export function EditCertification({ paths }: { paths: CertificationPaths }) {
  const { id = '' } = useParams();
  // There is no single-item API (#35): the list is small, so the form finds its row there.
  const loaded = useLoad('all', loadCertifications);
  const navigate = useNavigate();
  const certification =
    loaded.state === 'ok'
      ? loaded.data.certifications.find((item) => String(item.id) === id)
      : undefined;
  const update = async (form: CertificationForm) => {
    await certificationApi.update(Number(id), toCertificationInput(form));
    toast.success('Saved');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="Certification list" />
      <PageHeader title="Edit certification" description="Change what you need, then save." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load certifications. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'ok' && !certification ? (
        <Notice
          notice={{ kind: 'error', text: 'Certification not found. It may already be deleted.' }}
        />
      ) : null}
      {certification ? (
        <CertificationFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={certification.id}
          initial={toCertificationForm(certification)}
          submitLabel="Save"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
