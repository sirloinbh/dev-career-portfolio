import { ExternalLink, FolderKanban } from 'lucide-react';

import { Badge } from './components/ui/badge';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { errorText } from './lib/use-notice';
import { PageHeader } from './page-header';
import {
  isRunning,
  type Project,
  projectApi,
  projectPeriodText,
  projectRoleText,
  webLink,
} from './project-data';
import { TextBlocks } from './text-blocks';
import { useLoad } from './use-load';

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

/** A link that opens in a new tab; its name says whose link it is and that a tab opens. */
function OutLink({ href, label, project }: { href: string; label: string; project: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${project} ${label} (새 탭에서 열림)`}
      className="inline-flex min-h-9 items-center gap-1 rounded-sm text-body-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11"
    >
      {label}
      <ExternalLink aria-hidden className="size-3.5" />
    </a>
  );
}

function ProjectItem({ project }: { project: Project }) {
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
          {repository ? <OutLink href={repository} label="저장소" project={project.name} /> : null}
          {service ? <OutLink href={service} label="서비스" project={project.name} /> : null}
        </div>
      ) : null}
    </li>
  );
}

export function ProjectList() {
  const loaded = useLoad('all', loadProjects);
  const projects = loaded.state === 'ok' ? loaded.data.projects : [];
  const loading = loaded.state === 'loading';
  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <PageHeader title="프로젝트" description="참여한 프로젝트를 최근 시작 순으로 봅니다.">
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {loading ? '프로젝트를 불러오는 중' : ''}
          {loaded.state === 'ok' ? `프로젝트 ${projects.length}건` : ''}
        </p>
      </PageHeader>
      {loading ? <SkeletonList rows={3} /> : null}
      {loaded.state === 'error' ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `프로젝트를 불러오지 못했습니다. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {loaded.state === 'ok' && projects.length === 0 ? (
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
            <ProjectItem key={project.id} project={project} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
