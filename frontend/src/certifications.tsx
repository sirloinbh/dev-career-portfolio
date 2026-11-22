import { Award, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import {
  type Certification,
  certificationApi,
  certificationFieldOf,
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
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import { EditItemPage, NewItemPage } from './item-form-page';
import { ItemListPage, ItemUl } from './item-list-page';
import { cn } from './lib/utils';
import { serviceToday } from './service-date';
import { TextBlocks } from './text-blocks';

const loadCertifications = () => certificationApi.list();
const loadCertificationsRows = () =>
  loadCertifications().then((response) => response.certifications);

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
  // Read once per render: the badge follows the service date, not the device's time zone.
  const today = serviceToday();
  return (
    <ItemListPage<Certification>
      load={loadCertificationsRows}
      title="Certifications"
      description="See your certifications and exam results, newest first."
      noun="certifications"
      addLabel="Add certification"
      addTo={paths.create}
      empty={{
        icon: <Award />,
        title: 'No certifications added yet',
        description: 'Choose Add certification and it will appear here, newest first.',
      }}
      deleteNoun="certification"
      deleteName={(row) => row.name}
      removeRow={(row) => certificationApi.remove(row.id)}
      renderRows={(rows, onDelete) => (
        <ItemUl label="Certification list">
          {rows.map((row) => (
            <CertificationItem
              key={row.id}
              certification={row}
              today={today}
              paths={paths}
              onDelete={onDelete}
            />
          ))}
        </ItemUl>
      )}
    />
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
    useServerForm(certificationFieldOf);
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
  return (
    <NewItemPage
      paths={paths}
      texts={{ noun: 'certification', backLabel: 'Certification list' }}
      description="Certification name, issuer, and date earned are all you need. The rest can stay empty."
      initial={emptyCertificationForm}
      create={async (form) =>
        (await certificationApi.create(toCertificationInput(form))).certification.name
      }
      Fields={CertificationFields}
    />
  );
}

export function EditCertification({ paths }: { paths: CertificationPaths }) {
  return (
    <EditItemPage
      paths={paths}
      texts={{ noun: 'certification', backLabel: 'Certification list' }}
      loadItems={loadCertificationsRows}
      toForm={toCertificationForm}
      update={(item, form) => certificationApi.update(item.id, toCertificationInput(form))}
      Fields={CertificationFields}
    />
  );
}
