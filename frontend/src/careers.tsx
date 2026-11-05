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
import { controlClass } from './form-fields';
import { useServerForm } from './form-state';
import { errorText } from './lib/use-notice';
import { cn } from './lib/utils';
import { BackLink, PageHeader } from './page-header';
import { useLoad, useReloading } from './use-load';

const loadCareers = () => careerApi.list();

/**
 * Labelled free text (duties, achievements), only the entries that were filled in. A description
 * list ties each label to its text, so a screen reader announces where one block ends.
 */
function TextBlocks({ entries }: { entries: [label: string, text: string | null][] }) {
  const filled = entries.filter(([, text]) => text);
  if (filled.length === 0) return null;
  return (
    <dl className="flex flex-col gap-2">
      {filled.map(([label, text]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-caption font-medium text-muted-foreground">{label}</dt>
          <dd className="text-body-sm wrap-break-word break-keep whitespace-pre-line">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

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
        {isCurrent(career) ? <Badge>재직 중</Badge> : null}
      </div>
      <p className="text-body-sm wrap-break-word break-keep">{roleText(career)}</p>
      {/* The period is the main fact of a career, so body size rather than text-meta (13px floor). */}
      <p className="text-body-sm text-muted-foreground">{careerPeriodText(career)}</p>
      <TextBlocks
        entries={[
          ['담당 업무', career.duties],
          ['주요 성과', career.achievements],
        ]}
      />
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="outline" size="sm">
          <Link to={paths.edit(career.id)} aria-label={`${career.company} 수정`}>
            <Pencil aria-hidden />
            수정
          </Link>
        </Button>
        <ConfirmDialog
          title="이력을 지울까요?"
          description={
            <span className="break-keep">
              &apos;{career.company}&apos; 이력을 지웁니다. 지운 뒤에는 되돌릴 수 없습니다.
            </span>
          }
          onConfirm={() => onDelete(career)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`${career.company} 삭제`}>
              <Trash2 aria-hidden />
              삭제
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
      noun: '이력',
      name: career.company,
    });
    reload((current) => ({ careers: current.careers.filter((item) => item.id !== career.id) }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="이력"
        description="다닌 회사와 맡은 일을 최근 입사 순으로 봅니다."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? '이력을 불러오는 중' : ''}
          {data ? `이력 ${careers.length}건` : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          이력 추가
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `이력을 불러오지 못했습니다. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {data && careers.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Briefcase />}
          title="아직 등록한 이력이 없습니다"
          description="이력 추가를 누르면 최근 입사 순으로 여기에 보입니다."
        />
      ) : null}
      {careers.length > 0 ? (
        <ul
          aria-label="이력 목록"
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
    // The server checks every rule and answers in Korean, so the browser's own checks are off.
    <form
      noValidate
      onSubmit={submit(() => onSubmit(form))}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      {textField('company', '회사명', '예: 한빛소프트')}
      <div className="grid gap-5 sm:grid-cols-2">
        {textField('department', '부서', '예: 플랫폼팀')}
        {textField('position', '직책', '예: 선임 개발자')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('employmentType')}>고용 형태</Label>
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
          <Label htmlFor={fieldId('startDate')}>입사일</Label>
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
          <Label htmlFor={fieldId('endDate')}>퇴사일</Label>
          <Input
            id={fieldId('endDate')}
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
            지금 다니는 회사면 비워 둡니다. 목록에 &quot;재직 중&quot;으로 보입니다.
          </p>
          {errorFor('endDate')}
        </div>
      </div>
      {longField('duties', '담당 업무', '맡은 서비스, 역할, 사용한 기술')}
      {longField('achievements', '주요 성과', '숫자로 말할 수 있는 결과')}
      {actions({ submitLabel, cancelTo })}
    </form>
  );
}

export function NewCareer({ paths }: { paths: CareerPaths }) {
  const navigate = useNavigate();
  const create = async (form: CareerForm) => {
    const { career } = await careerApi.create(toCareerInput(form));
    toast.success(`'${career.company}' 이력을 추가했습니다`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="이력 목록" />
      <PageHeader
        title="이력 추가"
        description="회사명, 고용 형태, 입사일만 있으면 됩니다. 나머지는 비워 둘 수 있습니다."
      />
      <CareerFields
        initial={emptyCareerForm}
        submitLabel="추가"
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
    toast.success('저장했습니다');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="이력 목록" />
      <PageHeader title="이력 수정" description="바꿀 내용을 고친 뒤 저장합니다." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: `이력을 불러오지 못했습니다. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && !career ? (
        <Notice
          notice={{ kind: 'error', text: '이력을 찾을 수 없습니다. 이미 지웠을 수 있습니다.' }}
        />
      ) : null}
      {career ? (
        <CareerFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={career.id}
          initial={toCareerForm(career)}
          submitLabel="저장"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
