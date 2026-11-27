import { FolderKanban, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';

import { AttachmentSection } from './attachment-section';
import { type Career, careerList } from './career-data';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { ConfirmDialog } from './components/ui/confirm-dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { isValidId } from './entity-id';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import { EditItemPage, NewItemPage } from './item-form-page';
import { ItemListPage, ItemUl } from './item-list-page';
import { cn } from './lib/utils';
import { useKnownValues, useListQuery } from './list-query';
import { projectTools } from './list-tools';
import { OutLink } from './out-link';
import {
  emptyProjectForm,
  isRunning,
  type Project,
  projectApi,
  projectFieldOf,
  type ProjectForm,
  projectList,
  type ProjectPaths,
  projectPeriodText,
  projectRoleText,
  toProjectForm,
  toProjectInput,
} from './project-data';
import { ProjectSkillPicker } from './project-skill-picker';
import { skillList } from './skill-data';
import { TextBlocks } from './text-blocks';
import { TextControl } from './text-control';
import { webLink } from './web-link';

/** Technology names as tags. A long unspaced name wraps instead of widening the page at 390px. */
function Technologies({ names }: { names: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {names.map((name) => (
        <li key={name} className="max-w-full">
          <Badge variant="secondary" className="max-w-full wrap-anywhere whitespace-normal">
            {name}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function ProjectItem({
  project,
  careerCompany,
  skillNames,
  paths,
  onDelete,
}: {
  project: Project;
  /** The names of the skills this project used (#225). */
  skillNames: string[];
  /** The company of the linked career, if there is one (#224). */
  careerCompany?: string;
  paths: ProjectPaths;
  onDelete: (project: Project) => Promise<void>;
}) {
  const titleId = `project-${project.id}`;
  const roleText = projectRoleText(project, careerCompany);
  const repository = webLink(project.repositoryUrl);
  const service = webLink(project.serviceUrl);
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h2 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {project.name}
        </h2>
        {isRunning(project) ? <Badge>Ongoing</Badge> : null}
      </div>
      {roleText ? <p className="text-body-sm wrap-break-word break-keep">{roleText}</p> : null}
      <p className="text-body-sm text-muted-foreground">{projectPeriodText(project)}</p>
      <TextBlocks
        entries={[
          ['Summary', project.summary],
          ['Contributions', project.contributions],
          ['Technologies', skillNames.length > 0 ? <Technologies names={skillNames} /> : null],
        ]}
      />
      {repository || service ? (
        <div className="flex flex-wrap gap-x-4">
          {repository ? (
            <OutLink href={repository} label="Repository" owner={project.name} />
          ) : null}
          {service ? <OutLink href={service} label="Service" owner={project.name} /> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(project.id)} aria-label={`Edit ${project.name}`}>
            <Pencil aria-hidden />
            Edit
          </Link>
        </Button>
        <ConfirmDialog
          title="Delete this project?"
          description={
            <span className="wrap-anywhere break-keep">
              &apos;{project.name}&apos; will be deleted. This cannot be undone.
            </span>
          }
          onConfirm={() => onDelete(project)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`Delete ${project.name}`}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          }
        />
      </div>
    </li>
  );
}

/** The rows, each with the company of its linked career. The career list loads beside the projects. */
function ProjectRows({
  rows,
  paths,
  onDelete,
}: {
  rows: Project[];
  paths: ProjectPaths;
  onDelete: (project: Project) => Promise<void>;
}) {
  const { rows: careers } = useListQuery(careerList);
  const { rows: skills } = useListQuery(skillList);
  const companies = new Map((careers ?? []).map((career) => [career.id, career.company]));
  const skillName = new Map((skills ?? []).map((skill) => [skill.id, skill.name]));
  return (
    <ItemUl label="Project list">
      {rows.map((row) => (
        <ProjectItem
          key={row.id}
          project={row}
          careerCompany={row.careerId === null ? undefined : companies.get(row.careerId)}
          skillNames={row.skillIds.flatMap((id) => skillName.get(id) ?? [])}
          paths={paths}
          onDelete={onDelete}
        />
      ))}
    </ItemUl>
  );
}

export function ProjectList({ paths }: { paths: ProjectPaths }) {
  // The search also looks in the names of the skills a project used; the skills load beside the projects.
  const { rows: skills } = useListQuery(skillList);
  const tools = useMemo(
    () => projectTools(new Map((skills ?? []).map((skill) => [skill.id, skill.name]))),
    [skills],
  );
  return (
    <ItemListPage<Project>
      list={projectList}
      title="Projects"
      description="See the projects you worked on, newest start first."
      noun="projects"
      addLabel="Add project"
      addTo={paths.create}
      empty={{
        icon: <FolderKanban />,
        title: 'No projects added yet',
        description: 'Add a project and it will appear here, newest start first.',
      }}
      deleteNoun="project"
      deleteName={(row) => row.name}
      removeRow={(row) => projectApi.remove(row.id)}
      tools={tools}
      renderRows={(rows, onDelete) => <ProjectRows rows={rows} paths={paths} onDelete={onDelete} />}
    />
  );
}

/** "Hanbit Soft (2024)": the company and the start year tell two jobs at one company apart. */
const careerOption = (career: Career) => `${career.company} (${career.startDate.slice(0, 4)})`;

/** The form fields that hold text typed into one input (the skills are a list of ids). */
type TextField = Exclude<keyof ProjectForm, 'skillIds'>;

const pickOrganization = (row: Project) => row.organization;
const pickRole = (row: Project) => row.role;

function ProjectFields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: ProjectForm;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: ProjectForm) => Promise<unknown>;
}) {
  const [form, setForm] = useState(initial);
  const endDateInput = useRef<HTMLInputElement>(null);
  const { fieldId, describe, errorFor, clearOnEdit, submit, actions, pending } =
    useServerForm(projectFieldOf);
  // Values already used, suggested while typing; a new value is still accepted (#247).
  const known: Partial<Record<string, readonly string[]>> = {
    organization: useKnownValues(projectList, pickOrganization),
    role: useKnownValues(projectList, pickRole),
  };
  const { rows: careers } = useListQuery(careerList);
  const set = (field: TextField) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** A one-line text input with its label, an optional hint and the server's message about it. */
  const textField = (
    field: TextField,
    label: string,
    {
      placeholder,
      maxLength = 100,
      type = 'text',
      hint,
    }: { placeholder: string; maxLength?: number; type?: 'text' | 'url'; hint?: string },
  ) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <TextControl
        id={fieldId(field)}
        type={type}
        maxLength={maxLength}
        autoComplete="off"
        // Addresses are typed exactly: no capital first letter or spelling fixes on phones.
        autoCapitalize={type === 'url' ? 'off' : undefined}
        spellCheck={type === 'url' ? false : undefined}
        value={form[field]}
        onValueChange={set(field)}
        known={known[field]}
        placeholder={placeholder}
        {...(hint ? describe(field, `${fieldId(field)}-hint`) : describe(field))}
      />
      {hint ? (
        <p id={`${fieldId(field)}-hint`} className="text-caption break-keep text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {errorFor(field)}
    </div>
  );

  /** A multi-line text area for the summary and contributions. */
  const longField = (field: TextField, label: string, placeholder: string, maxLength: number) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId(field)}>{label}</Label>
      <textarea
        id={fieldId(field)}
        rows={maxLength > 500 ? 4 : 2}
        maxLength={maxLength}
        className={cn(controlClass, maxLength > 500 ? 'min-h-24 py-2' : 'min-h-16 py-2')}
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
      {textField('name', 'Project name', { placeholder: 'e.g. Order settlement automation' })}
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('careerId')}>Career</Label>
        <select
          id={fieldId('careerId')}
          className={cn(controlClass, 'h-9 sm:max-w-md')}
          value={form.careerId}
          onChange={(e) => set('careerId')(e.target.value)}
          {...describe('careerId')}
        >
          <option value="">No career (side project, school)</option>
          {(careers ?? []).map((career) => (
            <option key={career.id} value={String(career.id)}>
              {careerOption(career)}
            </option>
          ))}
        </select>
        {errorFor('careerId')}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {textField('organization', 'Organization', {
          placeholder: 'e.g. School, side project',
          hint: 'Used only when no career is chosen above.',
        })}
        {textField('role', 'Role', { placeholder: 'e.g. Backend development' })}
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
          {/* #33: an empty end date is how a running project is saved; there is no status field. */}
          <p
            id={`${fieldId('endDate')}-hint`}
            className="text-caption break-keep text-muted-foreground"
          >
            Leave it empty if the project is still running. The list shows &quot;Ongoing&quot;.
          </p>
          {errorFor('endDate')}
        </div>
      </div>
      {longField('summary', 'Summary', 'What the project was, in a sentence or two', 500)}
      {longField(
        'contributions',
        'Contributions',
        'Your part and results you can state in numbers',
        2000,
      )}
      <ProjectSkillPicker
        value={form.skillIds}
        onChange={(ids) => setForm((current) => ({ ...current, skillIds: ids }))}
        error={errorFor('skillIds')}
      />
      {textField('repositoryUrl', 'Repository link', {
        placeholder: 'e.g. https://github.com/user/repository',
        maxLength: 500,
        type: 'url',
        hint: 'Use an address that starts with http:// or https://.',
      })}
      {textField('serviceUrl', 'Service link', {
        placeholder: 'e.g. https://service.example.com',
        maxLength: 500,
        type: 'url',
      })}
      {actions({ submitLabel, cancelTo })}
    </form>
  );
}

export function NewProject({ paths }: { paths: ProjectPaths }) {
  return (
    <NewItemPage
      paths={paths}
      listPath={projectList.path}
      texts={{ noun: 'project', backLabel: 'Project list' }}
      description="Project name and start date are all you need. The rest can stay empty."
      initial={emptyProjectForm}
      create={async (form) => (await projectApi.create(toProjectInput(form))).project.name}
      Fields={ProjectFields}
    />
  );
}

export function EditProject({ paths }: { paths: ProjectPaths }) {
  const { id = '' } = useParams();
  return (
    <div className="flex flex-col gap-6">
      <EditItemPage
        paths={paths}
        texts={{ noun: 'project', backLabel: 'Project list' }}
        list={projectList}
        toForm={toProjectForm}
        update={(item, form) => projectApi.update(item.id, toProjectInput(form))}
        Fields={ProjectFields}
      />
      {isValidId(id) ? <AttachmentSection owner="projects" id={id} /> : null}
    </div>
  );
}
