import { QueryClientProvider } from '@tanstack/react-query';
import {
  Award,
  Briefcase,
  CalendarCheck,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Settings2,
  Wrench,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { BrowserRouter, generatePath, Navigate, Route, Routes } from 'react-router';

import type { ApplicationPaths } from './application-data';
import { ApplicationList, EditApplication, NewApplication } from './applications';
import type { CareerPaths } from './career-data';
import { CareerList, EditCareer, NewCareer } from './careers';
import type { CertificationPaths } from './certification-data';
import { CertificationList, EditCertification, NewCertification } from './certifications';
import { AppShell, type NavItem } from './components/layout/app-shell';
import { Toaster } from './components/ui/sonner';
import { EditQuestions } from './cover-letter-form';
import { ApplicationQuestions } from './cover-letter-questions';
import { type DashboardPaths, DashboardScreen } from './dashboard';
import type { EducationPaths } from './education-data';
import { EditEducation, EducationList, NewEducation } from './educations';
import type { Health } from './health';
import { createQueryClient } from './lib/query';
import type { ProjectPaths } from './project-data';
import { EditProject, NewProject, ProjectList } from './projects';
import { SettingsScreen } from './settings';
import { AccountActions, SignInGate } from './sign-in';
import type { SkillPaths } from './skill-data';
import { EditSkill, NewSkill, SkillList } from './skills';
import { TodayPage } from './today';

// Every page URL lives here (central docs/directory-rules.md).
const pages = {
  today: '/',
  dashboard: '/dashboard',
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
  newApplication: '/applications/new',
  applicationQuestions: '/applications/:id',
  editQuestions: '/applications/:id/questions/edit',
  editApplication: '/applications/:id/edit',
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

const applicationPaths: ApplicationPaths = {
  list: pages.applications,
  create: pages.newApplication,
  edit: (id) => generatePath(pages.editApplication, { id: String(id) }),
  questions: (id) => generatePath(pages.applicationQuestions, { id: String(id) }),
  editQuestions: (id) => generatePath(pages.editQuestions, { id: String(id) }),
};

const dashboardPaths: DashboardPaths = {
  educations: pages.educations,
  careers: pages.careers,
  projects: pages.projects,
  skills: pages.skills,
  certifications: pages.certifications,
  applications: pages.applications,
};

const careerPaths: CareerPaths = {
  list: pages.careers,
  create: pages.newCareer,
  edit: (id) => generatePath(pages.editCareer, { id: String(id) }),
  projectEdit: projectPaths.edit,
};

// Main menu (LNB) items, in display order.
const nav: NavItem[] = [
  { to: pages.today, label: 'Today', icon: CalendarCheck },
  { to: pages.educations, label: 'Education', icon: GraduationCap },
  { to: pages.careers, label: 'Career', icon: Briefcase },
  { to: pages.projects, label: 'Projects', icon: FolderKanban },
  { to: pages.skills, label: 'Skills', icon: Wrench },
  { to: pages.certifications, label: 'Certifications', icon: Award },
  { to: pages.applications, label: 'Cover letters', icon: FileText },
  { to: pages.dashboard, label: 'Dashboard', icon: LayoutDashboard },
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

function AppRoutes() {
  const health = useHealth();
  return (
    <BrowserRouter>
      <SignInGate>
        <AppShell appName="Dev Career Portfolio" nav={nav} actions={<AccountActions />}>
          <Routes>
            <Route path={pages.today} element={<TodayPage paths={applicationPaths} />} />
            <Route
              path={pages.dashboard}
              element={<DashboardScreen paths={dashboardPaths} health={health} />}
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
            <Route
              path={pages.applications}
              element={<ApplicationList paths={applicationPaths} />}
            />
            <Route
              path={pages.newApplication}
              element={<NewApplication paths={applicationPaths} />}
            />
            <Route
              path={pages.editApplication}
              element={<EditApplication paths={applicationPaths} />}
            />
            <Route
              path={pages.applicationQuestions}
              element={<ApplicationQuestions paths={applicationPaths} />}
            />
            <Route
              path={pages.editQuestions}
              element={<EditQuestions paths={applicationPaths} />}
            />
            <Route path={pages.settings} element={<SettingsScreen health={health} />} />
            <Route path="*" element={<Navigate to={pages.today} replace />} />
          </Routes>
        </AppShell>
        <Toaster />
      </SignInGate>
    </BrowserRouter>
  );
}

export function App() {
  // One client for the whole app, kept in state so a re-render does not make a new one (shared settings, #152).
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
