import { Award } from 'lucide-react';

import {
  type Certification,
  certificationApi,
  certificationPeriodText,
  isExpired,
  issuerText,
  serviceToday,
} from './certification-data';
import { Badge } from './components/ui/badge';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { errorText } from './lib/use-notice';
import { PageHeader } from './page-header';
import { TextBlocks } from './text-blocks';
import { useLoad } from './use-load';

const loadCertifications = () => certificationApi.list();

function CertificationItem({
  certification,
  today,
}: {
  certification: Certification;
  today: string;
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
        {isExpired(certification, today) ? <Badge variant="outline">만료됨</Badge> : null}
      </div>
      <p className="text-body-sm wrap-anywhere break-keep">{issuerText(certification)}</p>
      <p className="text-body-sm text-muted-foreground">{certificationPeriodText(certification)}</p>
      <TextBlocks entries={[['메모', certification.memo]]} />
    </li>
  );
}

export function CertificationList() {
  const loaded = useLoad('all', loadCertifications);
  const certifications = loaded.state === 'ok' ? loaded.data.certifications : [];
  const loading = loaded.state === 'loading';
  // Read once per render: the badge follows the service date, not the device's time zone.
  const today = serviceToday();
  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <PageHeader title="자격증" description="취득한 자격증과 시험 결과를 최근 취득 순으로 봅니다.">
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {loading ? '자격증을 불러오는 중' : ''}
          {loaded.state === 'ok' ? `자격증 ${certifications.length}건` : ''}
        </p>
      </PageHeader>
      {loading ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `자격증을 불러오지 못했습니다. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'ok' && certifications.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<Award />}
          title="아직 등록한 자격증이 없습니다"
          description="자격증을 등록하면 최근 취득 순으로 여기에 보입니다."
        />
      ) : null}
      {certifications.length > 0 ? (
        <ul
          aria-label="자격증 목록"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {certifications.map((certification) => (
            <CertificationItem key={certification.id} certification={certification} today={today} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
