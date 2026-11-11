import {
  Award,
  Briefcase,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  Wrench,
} from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter, generatePath, Navigate, Route, Routes } from 'react-router';

import { ApplicationList } from './applications';
import type { CareerPaths } from './career-data';
import { CareerList, EditCareer, NewCareer } from './careers';
import type { CertificationPaths } from './certification-data';
import { CertificationList, EditCertification, NewCertification } from './certifications';
import { AppShell, type NavItem } from './components/layout/app-shell';
import { EmptyState } from './components/ui/empty-state';
import { Toaster } from './components/ui/sonner';
import type { EducationPaths } from './education-data';
import { EditEducation, EducationList, NewEducation } from './educations';
import { type Health, healthText } from './health';
import type { ProjectPaths } from './project-data';
import { EditProject, NewProject, ProjectList } from './projects';
import type { SkillPaths } from './skill-data';
import { EditSkill, NewSkill, SkillList } from './skills';

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
  newProject: '/projects/new',
  editProject: '/projects/:id/edit',
  skills: '/skills',
  newSkill: '/skills/new',
  editSkill: '/skills/:id/edit',
  certifications: '/certifications',
  newCertification: '/certifications/new',
  editCertification: '/certifications/:id/edit',
  applications: '/applications',
  settings: '/settings',
} as const;

const educationPaths: EducationPaths = {
  list: pages.educations,
  create: pages.newEducation,
  edit: (id) => generatePath(pages.editEducation, { id: String(id) }),
};

const skillPaths: SkillPaths = {
  list: pages.skills,
  create: pages.newSkill,
  edit: (id) => generatePath(pages.editSkill, { id: String(id) }),
};

const projectPaths: ProjectPaths = {
  list: pages.projects,
  create: pages.newProject,
  edit: (id) => generatePath(pages.editProject, { id: String(id) }),
};

const certificationPaths: CertificationPaths = {
  list: pages.certifications,
  create: pages.newCertification,
  edit: (id) => generatePath(pages.editCertification, { id: String(id) }),
};

const careerPaths: CareerPaths = {
  list: pages.careers,
  create: pages.newCareer,
  edit: (id) => generatePath(pages.editCareer, { id: String(id) }),
};

// Main menu (LNB) items, in display order.
const nav: NavItem[] = [
  { to: pages.overview, label: 'Dashboard', icon: LayoutDashboard },
  { to: pages.educations, label: 'Education', icon: GraduationCap },
  { to: pages.careers, label: 'Career', icon: Briefcase },
  { to: pages.projects, label: 'Projects', icon: FolderKanban },
  { to: pages.skills, label: 'Skills', icon: Wrench },
  { to: pages.certifications, label: 'Certifications', icon: Award },
  { to: pages.applications, label: 'Cover letters', icon: FileText },
  { to: pages.settings, label: 'Settings', icon: Settings2 },
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
            : { state: 'error', message: data.error ?? 'Cannot check the server status' },
        );
      })
      .catch(() => setHealth({ state: 'error', message: 'Cannot reach the server' }));
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
          title="No features yet"
          description="Features are registered as GitHub issue cards and added one at a time."
        />
      )}
    </section>
  );
}

export function App() {
  const health = useHealth();
  return (
    <BrowserRouter>
      <AppShell appName="Dev Career Portfolio" nav={nav}>
        <Routes>
          <Route
            path={pages.overview}
            element={
              <Page
                title="Dashboard"
                description="A personal portfolio service for organizing your career, projects, and skill growth"
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
          <Route path={pages.projects} element={<ProjectList paths={projectPaths} />} />
          <Route path={pages.newProject} element={<NewProject paths={projectPaths} />} />
          <Route path={pages.editProject} element={<EditProject paths={projectPaths} />} />
          <Route path={pages.skills} element={<SkillList paths={skillPaths} />} />
          <Route path={pages.newSkill} element={<NewSkill paths={skillPaths} />} />
          <Route path={pages.editSkill} element={<EditSkill paths={skillPaths} />} />
          <Route
            path={pages.certifications}
            element={<CertificationList paths={certificationPaths} />}
          />
          <Route
            path={pages.newCertification}
            element={<NewCertification paths={certificationPaths} />}
          />
          <Route
            path={pages.editCertification}
            element={<EditCertification paths={certificationPaths} />}
          />
          <Route path={pages.applications} element={<ApplicationList />} />
          <Route
            path={pages.settings}
            element={
              <Page
                title="Settings"
                description="App settings and data management"
                health={health}
              />
            }
          />
          <Route path="*" element={<Navigate to={pages.overview} replace />} />
        </Routes>
      </AppShell>
      <Toaster />
    </BrowserRouter>
  );
}
