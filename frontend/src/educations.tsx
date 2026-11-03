import { GraduationCap } from 'lucide-react';

import { Badge } from './components/ui/badge';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import {
  degreeLabels,
  type Education,
  educationApi,
  gpaText,
  periodText,
  statusLabels,
} from './education-data';
import { errorText } from './lib/use-notice';
import { useLoad } from './use-load';

const loadEducations = () => educationApi.list();

function EducationItem({ education }: { education: Education }) {
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
    </li>
  );
}

export function EducationList() {
  const loaded = useLoad('all', loadEducations);
  const educations = loaded.state === 'ok' ? loaded.data.educations : [];

  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <header className="flex flex-col gap-2">
        <h1 id="page-title">학력</h1>
        <p className="text-body break-keep text-muted-foreground">
          학교와 전공, 재학 기간을 최근 입학 순으로 봅니다.
        </p>
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {loaded.state === 'loading' ? '학력을 불러오는 중' : ''}
          {loaded.state === 'ok' ? `학력 ${educations.length}건` : ''}
        </p>
      </header>
      {loaded.state === 'loading' ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `학력을 불러오지 못했습니다. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && educations.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<GraduationCap />}
          title="아직 등록한 학력이 없습니다"
          description="학력을 추가하면 최근 입학 순으로 여기에 보입니다."
        />
      ) : null}
      {educations.length > 0 ? (
        <ul
          aria-label="학력 목록"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {educations.map((education) => (
            <EducationItem key={education.id} education={education} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
