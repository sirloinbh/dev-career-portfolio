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
        {isRunning(project) ? <Badge>진행 중</Badge> : null}
      </div>
      {roleText ? <p className="text-body-sm wrap-break-word break-keep">{roleText}</p> : null}
      <p className="text-body-sm text-muted-foreground">{projectPeriodText(project)}</p>
      <TextBlocks
        entries={[
          ['요약', project.summary],
          ['기여와 성과', project.contributions],
          [
            '사용 기술',
            project.technologies.length > 0 ? <Technologies names={project.technologies} /> : null,
          ],
        ]}
      />
      {repository || service ? (
        <div className="flex flex-wrap gap-x-4">
          {repository ? <OutLink href={repository} label="저장소" owner={project.name} /> : null}
          {service ? <OutLink href={service} label="서비스" owner={project.name} /> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(project.id)} aria-label={`${project.name} 수정`}>
            <Pencil aria-hidden />
            수정
          </Link>
        </Button>
        <ConfirmDialog
          title="프로젝트를 지울까요?"
          description={
            <span className="wrap-anywhere break-keep">
              &apos;{project.name}&apos; 프로젝트를 지웁니다. 지운 뒤에는 되돌릴 수 없습니다.
            </span>
          }
          onConfirm={() => onDelete(project)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`${project.name} 삭제`}>
              <Trash2 aria-hidden />
              삭제
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
      noun: '프로젝트',
      name: project.name,
    });
    reload((current) => ({ projects: current.projects.filter((item) => item.id !== project.id) }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="프로젝트"
        description="참여한 프로젝트를 최근 시작 순으로 봅니다."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? '프로젝트를 불러오는 중' : ''}
          {data ? `프로젝트 ${projects.length}건` : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          프로젝트 추가
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `프로젝트를 불러오지 못했습니다. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {data && projects.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<FolderKanban />}
          title="아직 등록한 프로젝트가 없습니다"
          description="프로젝트를 등록하면 최근 시작 순으로 여기에 보입니다."
        />
      ) : null}
      {projects.length > 0 ? (
        <ul
          aria-label="프로젝트 목록"
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
    // The server checks every rule and answers in Korean, so the browser's own checks are off.
    <form
      noValidate
      onSubmit={submit(() =>
        onSubmit({ ...form, endDate: typedDate(endDateInput.current, form.endDate) }),
      )}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      {textField('name', '프로젝트명', { placeholder: '예: 주문 정산 자동화' })}
      <div className="grid gap-5 sm:grid-cols-2">
        {textField('organization', '소속', { placeholder: '예: 한빛소프트, 개인 프로젝트' })}
        {textField('role', '역할', { placeholder: '예: 백엔드 개발' })}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('startDate')}>시작일</Label>
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
          <Label htmlFor={fieldId('endDate')}>종료일</Label>
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
            진행 중인 프로젝트면 비워 둡니다. 목록에 &quot;진행 중&quot;으로 보입니다.
          </p>
          {errorFor('endDate')}
        </div>
      </div>
      {longField('summary', '요약', '어떤 프로젝트였는지 한두 문장으로', 500)}
      {longField('contributions', '기여와 성과', '맡은 부분과 숫자로 말할 수 있는 결과', 2000)}
      {textField('technologies', '사용 기술', {
        placeholder: '예: TypeScript, PostgreSQL, AWS',
        // 30 names of up to 50 characters, with ", " between them.
        maxLength: 1600,
        hint: '쉼표(,)로 나눠 적습니다. 항목마다 50자, 30개까지 넣을 수 있습니다.',
      })}
      {textField('repositoryUrl', '저장소 링크', {
        placeholder: '예: https://github.com/사용자/저장소',
        maxLength: 500,
        type: 'url',
        hint: 'http:// 또는 https://로 시작하는 주소를 넣습니다.',
      })}
      {textField('serviceUrl', '서비스 링크', {
        placeholder: '예: https://service.example.com',
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
    toast.success(`'${project.name}' 프로젝트를 추가했습니다`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="프로젝트 목록" />
      <PageHeader
        title="프로젝트 추가"
        description="프로젝트명과 시작일만 있으면 됩니다. 나머지는 비워 둘 수 있습니다."
      />
      <ProjectFields
        initial={emptyProjectForm}
        submitLabel="추가"
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
    toast.success('저장했습니다');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="프로젝트 목록" />
      <PageHeader title="프로젝트 수정" description="바꿀 내용을 고친 뒤 저장합니다." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{
            kind: 'error',
            text: `프로젝트를 불러오지 못했습니다. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'ok' && !project ? (
        <Notice
          notice={{ kind: 'error', text: '프로젝트를 찾을 수 없습니다. 이미 지웠을 수 있습니다.' }}
        />
      ) : null}
      {project ? (
        <ProjectFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={project.id}
          initial={toProjectForm(project)}
          submitLabel="저장"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
