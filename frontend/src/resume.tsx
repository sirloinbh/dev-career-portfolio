import { Download, Printer } from 'lucide-react';
import { useState } from 'react';

import { applicationList } from './application-data';
import { applicationProjectsApi } from './application-projects-data';
import { type Career, careerList } from './career-data';
import { type Certification, certificationList } from './certification-data';
import { downloadBlob } from './components/file-field/download-blob';
import { Button } from './components/ui/button';
import { Label } from './components/ui/label';
import { NativeSelect } from './components/ui/native-select';
import { Notice } from './components/ui/notice';
import { PageHeader } from './components/ui/page-header';
import { SkeletonList } from './components/ui/skeleton';
import { type Education, educationList } from './education-data';
import { useListQuery } from './list-query';
import { type Project, projectList } from './project-data';
import {
  buildResume,
  resumeHtml,
  resumeMarkdown,
  type ResumeSection,
  type ResumeSectionKey,
  resumeSectionKeys,
  resumeSectionTitles,
  type ResumeSelection,
} from './resume-document';
import { type Skill, skillList } from './skill-data';

// The resume screen (#234): pick sections and items, see the preview, then download Markdown or print the page.

/** The name each item has in its checkbox list. */
const labels = {
  careers: (c: Career) => c.company,
  projects: (p: Project) => p.name,
  educations: (e: Education) => e.school,
  certifications: (c: Certification) => c.name,
  skills: (s: Skill) => s.name,
} satisfies Record<ResumeSectionKey, (row: never) => string>;

/** Everything starts checked, so the first preview is the whole resume. `picked` holds only what the person changed. */
function selectionOf(
  rows: Record<ResumeSectionKey, readonly { id: number }[]>,
  picked: Partial<Record<ResumeSectionKey, readonly number[]>>,
): ResumeSelection {
  const pick = (key: ResumeSectionKey) => new Set(picked[key] ?? rows[key].map((row) => row.id));
  return {
    careers: pick('careers'),
    projects: pick('projects'),
    educations: pick('educations'),
    certifications: pick('certifications'),
    skills: pick('skills'),
  };
}

export function ResumeScreen() {
  const careers = useListQuery(careerList);
  const projects = useListQuery(projectList);
  const educations = useListQuery(educationList);
  const certifications = useListQuery(certificationList);
  const skills = useListQuery(skillList);
  const { rows: applications } = useListQuery(applicationList);
  const [picked, setPicked] = useState<Partial<Record<ResumeSectionKey, readonly number[]>>>({});
  const [note, setNote] = useState('');
  const [startNote, setStartNote] = useState('');

  /** Checks only the projects the application highlights; the other sections keep their checks. */
  async function startFrom(applicationId: string) {
    setStartNote('');
    if (applicationId === '') return;
    try {
      const { projectIds } = await applicationProjectsApi.read(applicationId);
      setPicked((current) => ({ ...current, projects: projectIds }));
      setStartNote(
        projectIds.length === 0
          ? 'This application has no highlighted projects yet, so no project is checked.'
          : `Checked the ${String(projectIds.length)} highlighted ${projectIds.length === 1 ? 'project' : 'projects'}.`,
      );
    } catch {
      setStartNote('Could not load the highlighted projects of that application.');
    }
  }

  const queries = [careers, projects, educations, certifications, skills];
  const failed = queries.find((q) => q.query.isError);
  const rows = {
    careers: careers.rows,
    projects: projects.rows,
    educations: educations.rows,
    certifications: certifications.rows,
    skills: skills.rows,
  };
  const loaded = resumeSectionKeys.every((key) => rows[key] !== undefined);

  let content;
  if (!loaded) {
    content = failed ? (
      <Notice
        notice={{
          kind: 'error',
          text: 'Could not load your resume data. Check your connection and reload the page.',
        }}
      />
    ) : (
      <SkeletonList rows={3} />
    );
  } else {
    const all = {
      careers: rows.careers ?? [],
      projects: rows.projects ?? [],
      educations: rows.educations ?? [],
      certifications: rows.certifications ?? [],
      skills: rows.skills ?? [],
    };
    const selection = selectionOf(all, picked);
    const sections = buildResume(all, selection);
    const empty = sections.length === 0;

    const toggle = (key: ResumeSectionKey, id: number, checked: boolean) => {
      const now = [...selection[key]];
      setPicked({ ...picked, [key]: checked ? [...now, id] : now.filter((x) => x !== id) });
    };

    const print = () => {
      // A new window holds the print page, so the menu and buttons never reach the paper.
      const win = window.open('', '_blank');
      if (!win) {
        setNote('The browser blocked the print window. Allow pop-ups for this site and try again.');
        return;
      }
      setNote('');
      win.document.write(resumeHtml(sections));
      win.document.close();
      win.focus();
      win.print();
    };

    content = (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {applications && applications.length > 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="resume-start">Start from an application</Label>
              <NativeSelect
                id="resume-start"
                defaultValue=""
                onChange={(e) => void startFrom(e.target.value)}
              >
                <option value="">Choose an application</option>
                {applications.map((application) => (
                  <option key={application.id} value={application.id}>
                    {application.companyName}
                  </option>
                ))}
              </NativeSelect>
              {startNote ? (
                <p role="status" className="text-caption text-muted-foreground">
                  {startNote}
                </p>
              ) : null}
            </div>
          ) : null}
          {resumeSectionKeys.map((key) => {
            const items = all[key];
            const label = labels[key] as (row: unknown) => string;
            return (
              <fieldset key={key} className="flex flex-col gap-2 rounded-xl border p-4">
                <legend className="px-1 text-body-sm font-medium">
                  {resumeSectionTitles[key]}
                </legend>
                {items.length === 0 ? (
                  <p className="text-caption text-muted-foreground">Nothing added yet.</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Select all ${resumeSectionTitles[key]}`}
                        onClick={() => setPicked({ ...picked, [key]: items.map((r) => r.id) })}
                      >
                        All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`Select no ${resumeSectionTitles[key]}`}
                        onClick={() => setPicked({ ...picked, [key]: [] })}
                      >
                        None
                      </Button>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {items.map((item) => (
                        <li key={item.id}>
                          <label className="flex items-center gap-2 text-body-sm">
                            <input
                              type="checkbox"
                              className="size-4"
                              checked={selection[key].has(item.id)}
                              onChange={(e) => toggle(key, item.id, e.target.checked)}
                            />
                            <span className="wrap-anywhere break-keep">{label(item)}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </fieldset>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={empty}
              onClick={() =>
                downloadBlob('resume.md', 'text/markdown;charset=utf-8', resumeMarkdown(sections))
              }
            >
              <Download aria-hidden />
              Download Markdown
            </Button>
            <Button type="button" variant="outline" disabled={empty} onClick={print}>
              <Printer aria-hidden />
              Print or save as PDF
            </Button>
          </div>
          {note ? (
            <p role="alert" className="text-body-sm text-destructive">
              {note}
            </p>
          ) : null}
          <Preview sections={sections} />
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <PageHeader
        title="Resume"
        description="Pick what to include and get a resume as Markdown or a print-ready page."
      />
      {content}
    </section>
  );
}

function Preview({ sections }: { sections: readonly ResumeSection[] }) {
  if (sections.length === 0) {
    return (
      <p role="status" className="rounded-xl border p-4 text-body-sm text-muted-foreground">
        Nothing is selected yet. Check an item to see it here.
      </p>
    );
  }
  return (
    <article
      aria-label="Resume preview"
      className="flex flex-col gap-5 rounded-xl border bg-card p-4"
    >
      {sections.map((section) => (
        <section key={section.key} aria-label={section.title} className="flex flex-col gap-3">
          <h2 className="border-b pb-1 text-body font-semibold">{section.title}</h2>
          {section.entries.map((entry, index) => (
            <div key={`${entry.heading}-${String(index)}`} className="flex flex-col gap-1">
              <h3 className="text-body-sm font-semibold">{entry.heading}</h3>
              {entry.meta.length > 0 ? (
                <p className="text-caption text-muted-foreground">{entry.meta.join(' · ')}</p>
              ) : null}
              {entry.blocks.map((block) => (
                <p key={block.label} className="text-body-sm wrap-break-word whitespace-pre-line">
                  <span className="font-medium">{block.label}: </span>
                  {block.text.trim()}
                </p>
              ))}
              {entry.tags.length > 0 ? (
                <p className="text-body-sm">
                  <span className="font-medium">Technologies: </span>
                  {entry.tags.join(', ')}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
