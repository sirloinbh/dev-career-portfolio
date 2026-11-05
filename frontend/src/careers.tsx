import { Briefcase } from 'lucide-react';

import { type Career, careerApi, careerPeriodText, isCurrent, roleText } from './career-data';
import { Badge } from './components/ui/badge';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { errorText } from './lib/use-notice';
import { PageHeader } from './page-header';
import { useLoad } from './use-load';

const loadCareers = () => careerApi.list();

/** A labelled block of free text (duties, achievements), shown only when it was entered. */
function TextBlock({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
      <p className="text-body-sm wrap-break-word break-keep whitespace-pre-line">{text}</p>
    </div>
  );
}

function CareerItem({ career }: { career: Career }) {
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
      <TextBlock label="담당 업무" text={career.duties} />
      <TextBlock label="주요 성과" text={career.achievements} />
    </li>
  );
}

export function CareerList() {
  const loaded = useLoad('all', loadCareers);
  const careers = loaded.state === 'ok' ? loaded.data.careers : [];
  const loading = loaded.state === 'loading';
  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <PageHeader title="이력" description="다닌 회사와 맡은 일을 최근 입사 순으로 봅니다.">
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {loading ? '이력을 불러오는 중' : ''}
          {loaded.state === 'ok' ? `이력 ${careers.length}건` : ''}
        </p>
      </PageHeader>
      {loading ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{ kind: 'error', text: `이력을 불러오지 못했습니다. ${errorText(loaded.error)}` }}
        />
      ) : null}
      {loaded.state === 'ok' && careers.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Briefcase />}
          title="아직 등록한 이력이 없습니다"
          description="이력을 등록하면 최근 입사 순으로 여기에 보입니다."
        />
      ) : null}
      {careers.length > 0 ? (
        <ul
          aria-label="이력 목록"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {careers.map((career) => (
            <CareerItem key={career.id} career={career} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
