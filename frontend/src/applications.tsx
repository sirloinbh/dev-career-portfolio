import { FileText } from 'lucide-react';

import {
  type Application,
  applicationApi,
  applicationStatusLabels,
  deadlineText,
} from './application-data';
import { Badge } from './components/ui/badge';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { errorText } from './lib/use-notice';
import { OutLink } from './out-link';
import { PageHeader } from './page-header';
import { serviceToday } from './service-date';
import { TextBlocks } from './text-blocks';
import { useLoad } from './use-load';
import { webLink } from './web-link';

const loadApplications = () => applicationApi.list();

// The word carries the status; the fill only helps tell the three apart at a glance.
const statusVariant = {
  drafting: 'default',
  submitted: 'secondary',
  closed: 'outline',
} as const;

function ApplicationItem({ application, today }: { application: Application; today: string }) {
  const titleId = `application-${application.id}`;
  const posting = webLink(application.postingUrl);
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* break-keep keeps Korean words whole; wrap-anywhere still breaks a long unspaced name at 390px. */}
        <h2 id={titleId} className="text-body font-semibold wrap-anywhere break-keep">
          {application.companyName}
        </h2>
        <Badge variant={statusVariant[application.status]}>
          {applicationStatusLabels[application.status]}
        </Badge>
      </div>
      {application.position ? (
        <p className="text-body-sm wrap-anywhere break-keep">{application.position}</p>
      ) : null}
      <p className="text-body-sm text-muted-foreground">{deadlineText(application, today)}</p>
      <TextBlocks entries={[['메모', application.memo]]} />
      {posting ? (
        <div className="flex flex-wrap gap-x-4">
          <OutLink href={posting} label="채용 공고" owner={application.companyName} />
        </div>
      ) : null}
    </li>
  );
}

export function ApplicationList() {
  const loaded = useLoad('all', loadApplications);
  const applications = loaded.state === 'ok' ? loaded.data.applications : [];
  const loading = loaded.state === 'loading';
  // Read once per render: the countdown follows the service date, not the device's time zone.
  const today = serviceToday();
  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <PageHeader
        title="자기소개서"
        description="지원한 기업을 작성 중, 제출 완료, 종료 순으로 보고, 마감이 가까운 곳부터 챙깁니다."
      >
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {loading ? '지원 기업을 불러오는 중' : ''}
          {loaded.state === 'ok' ? `지원 기업 ${applications.length}건` : ''}
        </p>
      </PageHeader>
      {loading ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `지원 기업을 불러오지 못했습니다. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'ok' && applications.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<FileText />}
          title="아직 등록한 지원 기업이 없습니다"
          description="지원 기업을 등록하면 상태와 마감일 순으로 여기에 보입니다."
        />
      ) : null}
      {applications.length > 0 ? (
        <ul
          aria-label="지원 기업 목록"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {applications.map((application) => (
            <ApplicationItem key={application.id} application={application} today={today} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
