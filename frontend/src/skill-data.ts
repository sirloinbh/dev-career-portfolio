import { splitFieldErrors } from './field-errors';
import { requestJson } from './lib/api';

// Skills (#34 API, #44 list, #45 form): API calls and display rules. The screens are in skills.tsx.

// The same six values, in the same order, as backend/src/routes/skills.ts; the list shows the
// groups in this order.
export const skillCategories = [
  'language',
  'framework',
  'database',
  'infrastructure',
  'tool',
  'other',
] as const;
type SkillCategory = (typeof skillCategories)[number];

export type Skill = {
  id: number;
  name: string;
  category: SkillCategory;
  /** 1 to 5 (#34); see proficiencyLevels for what each step means. */
  proficiency: number;
  memo: string | null;
};

export const skillCategoryLabels: Record<SkillCategory, string> = {
  language: 'Language',
  framework: 'Framework / library',
  database: 'Database',
  infrastructure: 'Infrastructure / cloud',
  tool: 'Tool',
  other: 'Other',
};

/** What each proficiency step means (#45 decision), from 1 to 5. */
export const proficiencyLevels = [
  { value: 1, name: 'Beginner', criterion: 'I have followed examples' },
  { value: 2, name: 'Basic', criterion: 'I can build small features with the docs' },
  { value: 3, name: 'Working', criterion: 'I can build and fix production features on my own' },
  { value: 4, name: 'Advanced', criterion: 'I can decide a design and review code from others' },
  { value: 5, name: 'Expert', criterion: 'I can solve hard problems and teach the team' },
] as const;

/** The highest proficiency step. */
export const maxProficiency = proficiencyLevels.length;

/** "Advanced", or '' for a value outside 1–5 (the database allows only 1–5). */
export const proficiencyName = (proficiency: number) =>
  proficiencyLevels.find((level) => level.value === proficiency)?.name ?? '';

/**
 * The skills grouped by category, in the fixed category order; empty categories are left out.
 * Within a group the API's order is kept (strongest first, then the name).
 */
export function groupSkills(skills: Skill[]) {
  return skillCategories
    .map((category) => ({
      category,
      skills: skills.filter((skill) => skill.category === category),
    }))
    .filter((group) => group.skills.length > 0);
}

/** "Proficiency 4 of 5, Advanced": the proficiency read out in full. */
export function proficiencyText(proficiency: number) {
  const name = proficiencyName(proficiency);
  return `Proficiency ${String(proficiency)} of ${String(maxProficiency)}${name ? `, ${name}` : ''}`;
}

export type SkillPaths = {
  list: string;
  create: string;
  edit: (id: number) => string;
};

/** The form keeps every field as the text in its input; no proficiency is chosen yet as ''. */
export type SkillForm = {
  name: string;
  category: SkillCategory;
  proficiency: string;
  memo: string;
};

export const emptySkillForm: SkillForm = {
  name: '',
  category: 'language',
  proficiency: '',
  memo: '',
};

export function toSkillForm(skill: Skill): SkillForm {
  return {
    name: skill.name,
    category: skill.category,
    proficiency: String(skill.proficiency),
    memo: skill.memo ?? '',
  };
}

type SkillInput = {
  name: string;
  category: SkillCategory;
  proficiency: number | null;
  memo: string;
};

/**
 * The proficiency goes as a number, or null when none was chosen so the server answers in English.
 * A blank memo goes as '' and the server stores it as NULL.
 */
export function toSkillInput(form: SkillForm): SkillInput {
  return { ...form, proficiency: form.proficiency === '' ? null : Number(form.proficiency) };
}

// The server's messages start with these labels (backend/src/routes/skills.ts, shared.ts). The 409
// for a taken name names no label, so its own start ties it to the name field.
const fieldLabels: [string, keyof SkillForm][] = [
  ['Skill name', 'name'],
  ['This skill is already registered', 'name'],
  ['Category', 'category'],
  ['Proficiency', 'proficiency'],
  ['Notes', 'memo'],
];

// The order the inputs appear on screen (skills.tsx SkillFields).
const formOrder: (keyof SkillForm)[] = ['name', 'category', 'proficiency', 'memo'];

/** The server's message split per field, topmost field first (see field-errors.ts). */
export const skillFieldErrors = (message: string) =>
  splitFieldErrors(message, fieldLabels, formOrder);

const base = '/api/skills';

export const skillApi = {
  list: () => requestJson<{ skills: Skill[] }>(base),
  create: (input: SkillInput) =>
    requestJson<{ skill: Skill }>(base, { method: 'POST', body: input }),
  update: (id: number, input: SkillInput) =>
    requestJson<{ skill: Skill }>(`${base}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => requestJson<undefined>(`${base}/${id}`, { method: 'DELETE' }),
};
