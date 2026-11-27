import { type Career, careerPeriodText, roleText } from './career-data';
import { type Certification, certificationPeriodText, issuerText } from './certification-data';
import { degreeLabels, type Education, gpaText, periodText, statusLabels } from './education-data';
import { type Project, projectPeriodText, projectRoleText } from './project-data';
import { groupSkills, proficiencyName, type Skill, skillCategoryLabels } from './skill-data';

// The resume document (#234): picks the chosen items from the five resume lists and turns them into one structure.
// The screen draws that structure, and the same structure becomes Markdown and a print page, so the three always agree.

export const resumeSectionKeys = [
  'careers',
  'projects',
  'educations',
  'certifications',
  'skills',
] as const;
export type ResumeSectionKey = (typeof resumeSectionKeys)[number];

export const resumeSectionTitles: Record<ResumeSectionKey, string> = {
  careers: 'Career',
  projects: 'Projects',
  educations: 'Education',
  certifications: 'Certifications',
  skills: 'Skills',
};

export type ResumeData = {
  careers: readonly Career[];
  projects: readonly Project[];
  educations: readonly Education[];
  certifications: readonly Certification[];
  skills: readonly Skill[];
};

/** The ids chosen in each section. A section with nothing chosen is left out of the document. */
export type ResumeSelection = Record<ResumeSectionKey, ReadonlySet<number>>;

export type ResumeEntry = {
  heading: string;
  /** Short facts under the heading (period, role, issuer), joined with " · " when shown. */
  meta: string[];
  /** Labelled paragraphs, such as "Duties". Text keeps its line breaks. */
  blocks: { label: string; text: string }[];
  /** Names shown as a comma list, such as the skills a project used. */
  tags: string[];
};

export type ResumeSection = { key: ResumeSectionKey; title: string; entries: ResumeEntry[] };

const filled = (text: string | null | undefined): text is string => Boolean(text?.trim());

/** The entries of one section, only those chosen, in the order the list gives them. */
export function buildResume(data: ResumeData, selection: ResumeSelection): ResumeSection[] {
  const chosen = <R extends { id: number }>(key: ResumeSectionKey, rows: readonly R[]) =>
    rows.filter((row) => selection[key].has(row.id));
  const companies = new Map(data.careers.map((career) => [career.id, career.company]));
  const skillNames = new Map(data.skills.map((skill) => [skill.id, skill.name]));

  const sections: ResumeSection[] = [
    {
      key: 'careers',
      title: resumeSectionTitles.careers,
      entries: chosen('careers', data.careers).map((career) => ({
        heading: career.company,
        meta: [careerPeriodText(career), roleText(career)].filter(Boolean),
        blocks: [
          { label: 'Duties', text: career.duties },
          { label: 'Achievements', text: career.achievements },
        ].filter((block): block is { label: string; text: string } => filled(block.text)),
        tags: [],
      })),
    },
    {
      key: 'projects',
      title: resumeSectionTitles.projects,
      entries: chosen('projects', data.projects).map((project) => ({
        heading: project.name,
        meta: [
          projectPeriodText(project),
          projectRoleText(
            project,
            project.careerId === null ? undefined : companies.get(project.careerId),
          ),
        ].filter(Boolean),
        blocks: [
          { label: 'Summary', text: project.summary },
          { label: 'Contributions', text: project.contributions },
        ].filter((block): block is { label: string; text: string } => filled(block.text)),
        tags: project.skillIds.flatMap((id) => skillNames.get(id) ?? []),
      })),
    },
    {
      key: 'educations',
      title: resumeSectionTitles.educations,
      entries: chosen('educations', data.educations).map((education) => ({
        heading: education.school,
        meta: [
          [degreeLabels[education.degree], education.major].filter(Boolean).join(', '),
          statusLabels[education.status],
          periodText(education),
          gpaText(education),
        ].filter(Boolean),
        blocks: filled(education.memo) ? [{ label: 'Notes', text: education.memo }] : [],
        tags: [],
      })),
    },
    {
      key: 'certifications',
      title: resumeSectionTitles.certifications,
      entries: chosen('certifications', data.certifications).map((certification) => ({
        heading: certification.name,
        meta: [issuerText(certification), certificationPeriodText(certification)].filter(Boolean),
        blocks: filled(certification.memo) ? [{ label: 'Notes', text: certification.memo }] : [],
        tags: [],
      })),
    },
    {
      key: 'skills',
      title: resumeSectionTitles.skills,
      // Grouped by category like the Skills screen, so the same skills read in the same order.
      entries: groupSkills(chosen('skills', data.skills).slice()).flatMap((group) =>
        group.skills.map((skill) => ({
          heading: skill.name,
          meta: [skillCategoryLabels[group.category], proficiencyName(skill.proficiency)].filter(
            Boolean,
          ),
          blocks: [],
          tags: [],
        })),
      ),
    },
  ];
  return sections.filter((section) => section.entries.length > 0);
}

/** Markdown: "# Resume", one "##" per section and one "###" per entry. Empty sections are not written. */
export function resumeMarkdown(sections: readonly ResumeSection[]) {
  const lines = ['# Resume'];
  for (const section of sections) {
    lines.push('', `## ${section.title}`);
    for (const entry of section.entries) {
      lines.push('', `### ${entry.heading}`);
      if (entry.meta.length > 0) lines.push('', `_${entry.meta.join(' · ')}_`);
      for (const block of entry.blocks) lines.push('', `**${block.label}**`, '', block.text.trim());
      if (entry.tags.length > 0) lines.push('', `**Technologies**: ${entry.tags.join(', ')}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

const escapeHtml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/**
 * A complete page for the browser print dialog (PDF through "Save as PDF"). Every typed text is escaped, and the page
 * sets A4 with 18 mm margins so each browser prints the same layout.
 */
export function resumeHtml(sections: readonly ResumeSection[]) {
  const body = sections
    .map(
      (section) => `<section>
<h2>${escapeHtml(section.title)}</h2>
${section.entries
  .map(
    (entry) => `<article>
<h3>${escapeHtml(entry.heading)}</h3>
${entry.meta.length > 0 ? `<p class="meta">${escapeHtml(entry.meta.join(' · '))}</p>` : ''}
${entry.blocks
  .map(
    (block) =>
      `<p class="label">${escapeHtml(block.label)}</p>\n<p class="text">${escapeHtml(block.text.trim())}</p>`,
  )
  .join('\n')}
${entry.tags.length > 0 ? `<p class="label">Technologies</p>\n<p>${escapeHtml(entry.tags.join(', '))}</p>` : ''}
</article>`,
  )
  .join('\n')}
</section>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Resume</title>
<style>
@page { size: A4; margin: 18mm; }
body { font: 10.5pt/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 8pt; }
h2 { font-size: 13pt; margin: 16pt 0 6pt; padding-bottom: 3pt; border-bottom: 1px solid #999; }
h3 { font-size: 11pt; margin: 0; }
article { margin: 0 0 10pt; break-inside: avoid; }
p { margin: 2pt 0; }
.meta { color: #444; }
.label { font-weight: 600; margin-top: 5pt; }
.text { white-space: pre-line; overflow-wrap: anywhere; }
</style>
</head>
<body>
<h1>Resume</h1>
${body}
</body>
</html>
`;
}
