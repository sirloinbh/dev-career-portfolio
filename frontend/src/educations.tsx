import { GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useId, useRef, useState } from 'react';
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
import { Spinner } from './components/ui/spinner';
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
import { controlClass } from './form-fields';
import { RequestError } from './lib/api';
import { errorText, useNotice } from './lib/use-notice';
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
          <Link to={paths.edit(education.id)} aria-label={`${education.school} 수정`}>
            <Pencil aria-hidden />
            수정
          </Link>
        </Button>
        <ConfirmDialog
          title="학력을 지울까요?"
          description={
            <span className="break-keep">
              &apos;{education.school}&apos; 학력을 지웁니다. 지운 뒤에는 되돌릴 수 없습니다.
            </span>
          }
          onConfirm={() => onDelete(education)}
          trigger={
            <Button variant="outline" size="sm" aria-label={`${education.school} 삭제`}>
              <Trash2 aria-hidden />
              삭제
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
    try {
      await educationApi.remove(education.id);
    } catch (error) {
      // Already gone counts as deleted; anything else keeps the dialog open with the reason.
      if (!(error instanceof RequestError && error.status === 404)) {
        // The open dialog covers the page, so the reason goes in a toast above it.
        toast.error(`학력을 지우지 못했습니다. ${errorText(error)}`);
        throw error;
      }
    }
    toast.success(`'${education.school}' 학력을 지웠습니다`);
    reload((current) => ({
      educations: current.educations.filter((item) => item.id !== education.id),
    }));
    // The row and its delete button are gone, so focus would fall to the page body.
    requestAnimationFrame(() => heading.current?.focus());
  };

  return (
    <section aria-labelledby="page-title" aria-busy={firstLoad} className="flex flex-col gap-6">
      <PageHeader
        title="학력"
        description="학교와 전공, 재학 기간을 최근 입학 순으로 봅니다."
        headingRef={heading}
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {firstLoad ? '학력을 불러오는 중' : ''}
          {data ? `학력 ${educations.length}건` : ''}
        </p>
      </PageHeader>
      <Button asChild className="w-fit">
        <Link to={paths.create}>
          <Plus aria-hidden />
          학력 추가
        </Link>
      </Button>
      {firstLoad ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' && data === undefined ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `학력을 불러오지 못했습니다. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {data && educations.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<GraduationCap />}
          title="아직 등록한 학력이 없습니다"
          description="학력 추가를 누르면 최근 입학 순으로 여기에 보입니다."
        />
      ) : null}
      {educations.length > 0 ? (
        <ul
          aria-label="학력 목록"
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
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof EducationForm, string>>>({});
  const notice = useNotice();
  const submitButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const fieldId = (field: keyof EducationForm) => `${id}-${field}`;
  const set = (field: keyof EducationForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** aria props that tie a field to its hint and to the server's message about it. */
  const describe = (field: keyof EducationForm, hint?: string) => {
    const invalid = errors[field] !== undefined;
    const ids = [hint, invalid ? `${fieldId(field)}-error` : undefined].filter(Boolean).join(' ');
    return { 'aria-invalid': invalid || undefined, 'aria-describedby': ids || undefined };
  };
  const errorFor = (field: keyof EducationForm) =>
    errors[field] !== undefined ? (
      <p id={`${fieldId(field)}-error`} className="text-body-sm break-keep text-destructive">
        {errors[field]}
      </p>
    ) : null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrors({});
    notice.clear();
    onSubmit(form).catch((error: unknown) => {
      setPending(false);
      const message = errorText(error, '저장하지 못했습니다');
      const pieces =
        error instanceof RequestError && error.status === 400 ? fieldErrors(message) : [];
      const byField = Object.fromEntries(
        pieces.flatMap((piece) => (piece.field ? [[piece.field, piece.message]] : [])),
      ) as Partial<Record<keyof EducationForm, string>>;
      const first = pieces.find((piece) => piece.field)?.field;
      const unplaced = pieces.length ? pieces.filter((piece) => !piece.field) : [{ message }];
      if (unplaced.length) notice.error(unplaced.map((piece) => piece.message).join(', '));
      if (!first) {
        // The disabled button dropped focus; give it back so keyboard users stay in the form.
        requestAnimationFrame(() => submitButton.current?.focus());
        return;
      }
      // Show each Korean message under its input and move to the first, so it is read with the field.
      setErrors(byField);
      requestAnimationFrame(() => document.getElementById(fieldId(first))?.focus());
    });
  };

  const enrolled = form.status === 'enrolled';
  return (
    // The server checks every rule and answers in Korean, so the browser's own checks are off.
    <form
      noValidate
      onSubmit={submit}
      className="flex max-w-2xl flex-col gap-5"
      aria-busy={pending || undefined}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('school')}>학교명</Label>
        <Input
          id={fieldId('school')}
          maxLength={100}
          autoComplete="off"
          value={form.school}
          onChange={(e) => set('school')(e.target.value)}
          placeholder="예: 한국대학교"
          {...describe('school')}
        />
        {errorFor('school')}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('major')}>전공</Label>
        <Input
          id={fieldId('major')}
          maxLength={100}
          autoComplete="off"
          value={form.major}
          onChange={(e) => set('major')(e.target.value)}
          placeholder="예: 컴퓨터공학"
          {...describe('major')}
        />
        {errorFor('major')}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('degree')}>학위</Label>
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
          <Label htmlFor={fieldId('status')}>상태</Label>
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
              if (enrolledNow) setErrors((current) => ({ ...current, endDate: undefined }));
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
          <Label htmlFor={fieldId('startDate')}>입학일</Label>
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
          <Label htmlFor={fieldId('endDate')}>졸업일</Label>
          <Input
            id={fieldId('endDate')}
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
              ? '재학 중에는 졸업일을 넣지 않습니다.'
              : '휴학·중퇴로 정해진 날이 없으면 비워 둡니다.'}
          </p>
          {errorFor('endDate')}
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('gpa')}>학점</Label>
          <Input
            id={fieldId('gpa')}
            // Text, not type="number": a number input empties text it cannot read ("3..5"), so the
            // server would never see it and explain in Korean.
            inputMode="decimal"
            autoComplete="off"
            value={form.gpa}
            onChange={(e) => set('gpa')(e.target.value)}
            placeholder="예: 3.75"
            {...describe('gpa', `${id}-gpa-hint`)}
          />
          {errorFor('gpa')}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={fieldId('gpaScale')}>만점</Label>
          <Input
            id={fieldId('gpaScale')}
            inputMode="decimal"
            autoComplete="off"
            value={form.gpaScale}
            onChange={(e) => set('gpaScale')(e.target.value)}
            placeholder="예: 4.5"
            {...describe('gpaScale', `${id}-gpa-hint`)}
          />
          {errorFor('gpaScale')}
        </div>
        <p
          id={`${id}-gpa-hint`}
          className="text-caption break-keep text-muted-foreground sm:col-span-2"
        >
          학점과 만점은 함께 넣거나 함께 비워 둡니다. 소수 둘째 자리까지 넣을 수 있습니다.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId('memo')}>메모</Label>
        <textarea
          id={fieldId('memo')}
          rows={4}
          maxLength={2000}
          className={cn(controlClass, 'min-h-24 py-2')}
          value={form.memo}
          onChange={(e) => set('memo')(e.target.value)}
          placeholder="졸업 작품, 수상, 논문 등"
          {...describe('memo')}
        />
        {errorFor('memo')}
      </div>
      <Notice notice={notice.notice} />
      <div className="flex flex-wrap gap-2">
        <Button
          ref={submitButton}
          type="submit"
          disabled={pending}
          aria-busy={pending || undefined}
        >
          {pending ? <Spinner size="sm" label="저장하는 중" /> : null}
          {submitLabel}
        </Button>
        <Button asChild variant="outline">
          <Link to={cancelTo}>취소</Link>
        </Button>
      </div>
    </form>
  );
}

export function NewEducation({ paths }: { paths: EducationPaths }) {
  const navigate = useNavigate();
  const create = async (form: EducationForm) => {
    const { education } = await educationApi.create(toEducationInput(form));
    toast.success(`'${education.school}' 학력을 추가했습니다`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label="학력 목록" />
      <PageHeader
        title="학력 추가"
        description="학교명, 학위, 상태, 입학일만 있으면 됩니다. 나머지는 비워 둘 수 있습니다."
      />
      <EducationFields
        initial={emptyEducationForm}
        submitLabel="추가"
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
    toast.success('저장했습니다');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label="학력 목록" />
      <PageHeader title="학력 수정" description="바꿀 내용을 고친 뒤 저장합니다." />
      {loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {loaded.state === 'error' ? (
        <Notice
          notice={{ kind: 'error', text: `학력을 불러오지 못했습니다. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && !education ? (
        <Notice
          notice={{ kind: 'error', text: '학력을 찾을 수 없습니다. 이미 지웠을 수 있습니다.' }}
        />
      ) : null}
      {education ? (
        <EducationFields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={education.id}
          initial={toEducationForm(education)}
          submitLabel="저장"
          cancelTo={paths.list}
          onSubmit={update}
        />
      ) : null}
    </section>
  );
}
