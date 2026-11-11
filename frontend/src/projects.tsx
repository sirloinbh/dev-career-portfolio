import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
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
import { entryCount } from './entry-count';
import { controlClass } from './form-fields';
import { typedDate, useServerForm } from './form-state';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { OutLink } from './out-link';
import { BackLink, PageHeader } from './page-header';
import {
  emptyProjectForm,
  isRunning,
  type Project,
  projectApi,
  projectFieldErrors,
  type ProjectForm,
  type ProjectPaths,
  projectPeriodText,
  projectRoleText,
  toProjectForm,
  toProjectInput,
} from './project-data';
import { TextBlocks } from './text-blocks';
import { useLoad, useReloading } from './use-load';
import { webLink } from './web-link';

const loadProjects = () => projectApi.list();

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
  paths,
  onDelete,
}: {
  project: Project;
  paths: ProjectPaths;
  onDelete: (project: Project) => Promise<void>;
}) {
  const titleId = `project-${project.id}`;
  const roleText = projectRoleText(project);
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
          [
            'Technologies',
            project.technologies.length > 0 ? <Technologies names={project.technologies} /> : null,
          ],
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

export function ProjectList({ paths }: { paths: ProjectPaths }) {
  const { loaded, data, reload } = useReloading('all', loadProjects);
  const projects = data?.projects ?? [];
  const heading = useRef<HTMLHeadingElement>(null);
  // Only the first load shows the placeholder; a reload keeps the rows on screen.
  const firstLoad = loaded.state === 'loading' && data === undefined;

  const remove = async (project: Project) => {
    await deleteItem({
      remove: () => projectApi.remove(project.id),
      noun: 'project',
      name: project.name,
    });
    reload((current) => ({ projects: current.projects.filter((item) => item.id !== project.id) }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="See the projects you worked on, newest start first."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? 'Loading projects' : ''}
          {data ? entryCount(projects.length) : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          Add project
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load projects. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {data && projects.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<FolderKanban />}
          title="No projects added yet"
          description="Add a project and it will appear here, newest start first."
        />
      ) : null}
      {projects.length > 0 ? (
        <ul
          aria-label="Project list"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {projects.map((project) => (
            <ProjectItem key={project.id} project={project} paths={paths} onDelete={remove} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

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
  const { fieldId, describe, errorFor, submit, actions, pending } =
    useServerForm(projectFieldErrors);
  const set = (field: keyof ProjectForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** A one-line text input with its label, an optional hint and the server's message about it. */
  const textField = (
    field: keyof ProjectForm,
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
      <Input
        id={fieldId(field)}
        type={type}
        maxLength={maxLength}
        autoComplete="off"
        // Addresses are typed exactly: no capital first letter or spelling fixes on phones.
        autoCapitalize={type === 'url' ? 'off' : undefined}
        spellCheck={type === 'url' ? false : undefined}
        value={form[field]}
        onChange={(e) => set(field)(e.target.value)}
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
  const longField = (
    field: keyof ProjectForm,
    label: string,
    placeholder: string,
    maxLength: number,
  ) => (
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
      onSubmit={submit(() =>
        onSubmit({ ...form, endDate: typedDate(endDateInput.current, form.endDate) }),
      )}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      {textField('name', 'Project name', { placeholder: 'e.g. Order settlement automation' })}
      <div className="grid gap-5 sm:grid-cols-2">
        {textField('organization', 'Organization', {
          placeholder: 'e.g. Hanbit Soft, side project',
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
      {textField('technologies', 'Technologies', {
        placeholder: 'e.g. TypeScript, PostgreSQL, AWS',
        // 30 names of up to 50 characters, with ", " between them.
        maxLength: 1600,
        hint: 'Separate items with commas. Up to 30 items, 50 characters each.',
      })}
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
  const navigate = useNavigate();
  const create = async (form: ProjectForm) => {
    const { project } = await projectApi.create(toProjectInput(form));
    toast.success(`Added '${project.name}'`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="Project list" />
      <PageHeader
        title="Add project"
        description="Project name and start date are all you need. The rest can stay empty."
      />
      <ProjectFields
        initial={emptyProjectForm}
        submitLabel="Add"
        cancelTo={paths.list}
        onSubmit={create}
      />
    </section>
  );
}

export function EditProject({ paths }: { paths: ProjectPaths }) {
  const { id = '' } = useParams();
  // There is no single-item API (#33): the list is small, so the form finds its row there.
  const loaded = useLoad('all', loadProjects);
  const navigate = useNavigate();
  const project =
    loaded.state === 'ok' ? loaded.data.projects.find((item) => String(item.id) === id) : undefined;
  const update = async (form: ProjectForm) => {
    await projectApi.update(Number(id), toProjectInput(form));
    toast.success('Saved');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="Project list" />
      <PageHeader title="Edit project" description="Change what you need, then save." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load projects. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'ok' && !project ? (
        <Notice notice={{ kind: 'error', text: 'Project not found. It may already be deleted.' }} />
      ) : null}
      {project ? (
        <ProjectFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={project.id}
          initial={toProjectForm(project)}
          submitLabel="Save"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
