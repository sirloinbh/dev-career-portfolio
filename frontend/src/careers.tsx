import { Briefcase, Pencil, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';

import {
  type Career,
  careerApi,
  careerFieldOf,
  type CareerForm,
  careerList,
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
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import { EditItemPage, NewItemPage } from './item-form-page';
import { ItemListPage, ItemUl } from './item-list-page';
import { cn } from './lib/utils';
import { useKnownValues } from './list-query';
import { TextBlocks } from './text-blocks';
import { TextControl } from './text-control';

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
  return (
    <ItemListPage<Career>
      list={careerList}
      title="Career"
      description="See your employers and roles, newest start first."
      noun="career"
      addLabel="Add career"
      addTo={paths.create}
      empty={{
        icon: <Briefcase />,
        title: 'No career added yet',
        description: 'Choose Add career and it will appear here, newest start first.',
      }}
      deleteNoun="career"
      deleteName={(row) => row.company}
      removeRow={(row) => careerApi.remove(row.id)}
      renderRows={(rows, onDelete) => (
        <ItemUl label="Career list">
          {rows.map((row) => (
            <CareerItem key={row.id} career={row} paths={paths} onDelete={onDelete} />
          ))}
        </ItemUl>
      )}
    />
  );
}

const pickCompany = (row: Career) => row.company;
const pickDepartment = (row: Career) => row.department;
const pickPosition = (row: Career) => row.position;

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
  const { fieldId, describe, errorFor, clearOnEdit, submit, actions, pending } =
    useServerForm(careerFieldOf);
  // Values already used, suggested while typing; a new value is still accepted (#247).
  const known: Partial<Record<string, readonly string[]>> = {
    company: useKnownValues(careerList, pickCompany),
    department: useKnownValues(careerList, pickDepartment),
    position: useKnownValues(careerList, pickPosition),
  };
  const set = (field: keyof CareerForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** A one-line text input with its label and the server's message about it. */
  const textField = (field: keyof CareerForm, label: string, placeholder: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <TextControl
        id={fieldId(field)}
        maxLength={100}
        autoComplete="off"
        value={form[field]}
        onValueChange={set(field)}
        known={known[field]}
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
      onChange={clearOnEdit}
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
  return (
    <NewItemPage
      paths={paths}
      listPath={careerList.path}
      texts={{ noun: 'career', backLabel: 'Career list' }}
      description="Company, employment type, and start date are all you need. The rest can stay empty."
      initial={emptyCareerForm}
      create={async (form) => (await careerApi.create(toCareerInput(form))).career.company}
      Fields={CareerFields}
    />
  );
}

export function EditCareer({ paths }: { paths: CareerPaths }) {
  return (
    <EditItemPage
      paths={paths}
      texts={{ noun: 'career', backLabel: 'Career list' }}
      list={careerList}
      toForm={toCareerForm}
      update={(item, form) => careerApi.update(item.id, toCareerInput(form))}
      Fields={CareerFields}
    />
  );
}
