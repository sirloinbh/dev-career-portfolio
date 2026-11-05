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
  language: '언어',
  framework: '프레임워크·라이브러리',
  database: '데이터베이스',
  infrastructure: '인프라·클라우드',
  tool: '도구',
  other: '기타',
};

/** What each proficiency step means (#45 decision), from 1 to 5. */
export const proficiencyLevels = [
  { value: 1, name: '입문', criterion: '예제를 따라 해 봤습니다' },
  { value: 2, name: '기초', criterion: '문서를 보며 작은 기능을 만들 수 있습니다' },
  { value: 3, name: '실무', criterion: '혼자 실무 기능을 만들고 고칠 수 있습니다' },
  { value: 4, name: '숙련', criterion: '설계를 정하고 다른 사람의 코드를 검토할 수 있습니다' },
  { value: 5, name: '전문', criterion: '어려운 문제를 풀고 팀에 가르칠 수 있습니다' },
] as const;

/** The highest proficiency step. */
export const maxProficiency = proficiencyLevels.length;

/** "숙련", or '' for a value outside 1–5 (the database allows only 1–5). */
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

/** "숙련도 5점 중 4점, 숙련": the proficiency read out in full. */
export function proficiencyText(proficiency: number) {
  const name = proficiencyName(proficiency);
  return `숙련도 ${maxProficiency}점 중 ${proficiency}점${name ? `, ${name}` : ''}`;
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
 * The proficiency goes as a number, or null when none was chosen so the server answers in Korean.
 * A blank memo goes as '' and the server stores it as NULL.
 */
export function toSkillInput(form: SkillForm): SkillInput {
  return { ...form, proficiency: form.proficiency === '' ? null : Number(form.proficiency) };
}

// The server's messages start with these labels (backend/src/routes/skills.ts, shared.ts). The 409
// for a taken name names no label, so its own start ties it to the name field.
const fieldLabels: [string, keyof SkillForm][] = [
  ['스킬명', 'name'],
  ['이미 등록된 스킬', 'name'],
  ['분류', 'category'],
  ['숙련도', 'proficiency'],
  ['메모', 'memo'],
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
