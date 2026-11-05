import { Briefcase, FolderKanban, GraduationCap, LayoutDashboard, Settings2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, generatePath, Navigate, Route, Routes } from 'react-router';

import type { CareerPaths } from './career-data';
import { CareerList, EditCareer, NewCareer } from './careers';
import { AppShell, type NavItem } from './components/layout/app-shell';
import { EmptyState } from './components/ui/empty-state';
import { Toaster } from './components/ui/sonner';
import type { EducationPaths } from './education-data';
import { EditEducation, EducationList, NewEducation } from './educations';
import { type Health, healthText } from './health';
import { ProjectList } from './projects';

// Every page URL lives here (central docs/directory-rules.md).
const pages = {
  overview: '/',
  educations: '/educations',
  newEducation: '/educations/new',
  editEducation: '/educations/:id/edit',
  careers: '/careers',
  newCareer: '/careers/new',
  editCareer: '/careers/:id/edit',
  projects: '/projects',
  settings: '/settings',
} as const;

const educationPaths: EducationPaths = {
  list: pages.educations,
  create: pages.newEducation,
  edit: (id) => generatePath(pages.editEducation, { id: String(id) }),
};

const careerPaths: CareerPaths = {
  list: pages.careers,
  create: pages.newCareer,
  edit: (id) => generatePath(pages.editCareer, { id: String(id) }),
};

// Main menu (LNB) items, in display order.
const nav: NavItem[] = [
  { to: pages.overview, label: '대시보드', icon: LayoutDashboard },
  { to: pages.educations, label: '학력', icon: GraduationCap },
  { to: pages.careers, label: '이력', icon: Briefcase },
  { to: pages.projects, label: '프로젝트', icon: FolderKanban },
  { to: pages.settings, label: '설정', icon: Settings2 },
];

function useHealth() {
  const [health, setHealth] = useState<Health>({ state: 'loading' });
  useEffect(() => {
    fetch('/api/health')
      .then(async (response) => {
        const data = (await response.json()) as { today?: string; error?: string };
        setHealth(
          response.ok && data.today
            ? { state: 'ok', today: data.today }
            : { state: 'error', message: data.error ?? '서버 상태를 확인할 수 없습니다' },
        );
      })
      .catch(() => setHealth({ state: 'error', message: '서버에 연결할 수 없습니다' }));
  }, []);
  return health;
}

function Page({
  title,
  description,
  health,
  children,
}: {
  title: string;
  description: string;
  health: Health;
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 id="page-title">{title}</h1>
        <p className="text-body text-muted-foreground">{description}</p>
        {health.state === 'error' ? (
          <p role="alert" className="text-body-sm text-destructive">
            {healthText(health)}
          </p>
        ) : (
          <p role="status" className="text-caption text-muted-foreground">
            {healthText(health)}
          </p>
        )}
      </header>
      {children ?? (
        <EmptyState
          title="아직 기능이 없습니다"
          description="기능은 GitHub 이슈 카드로 등록한 뒤 하나씩 추가합니다."
        />
      )}
    </section>
  );
}

export function App() {
  const health = useHealth();
  return (
    <BrowserRouter>
      <AppShell appName="개발 커리어 포트폴리오" nav={nav}>
        <Routes>
          <Route
            path={pages.overview}
            element={
              <Page
                title="대시보드"
                description="개발 경력, 프로젝트, 기술 성장을 정리하는 개인 포트폴리오 서비스"
                health={health}
              />
            }
          />
          <Route path={pages.educations} element={<EducationList paths={educationPaths} />} />
          <Route path={pages.newEducation} element={<NewEducation paths={educationPaths} />} />
          <Route path={pages.editEducation} element={<EditEducation paths={educationPaths} />} />
          <Route path={pages.careers} element={<CareerList paths={careerPaths} />} />
          <Route path={pages.newCareer} element={<NewCareer paths={careerPaths} />} />
          <Route path={pages.editCareer} element={<EditCareer paths={careerPaths} />} />
          <Route path={pages.projects} element={<ProjectList />} />
          <Route
            path={pages.settings}
            element={<Page title="설정" description="앱 환경과 데이터 관리" health={health} />}
          />
          <Route path="*" element={<Navigate to={pages.overview} replace />} />
        </Routes>
      </AppShell>
      <Toaster />
    </BrowserRouter>
  );
}
