import { requestJson } from './lib/api';

// Skills (#34 API, #44 list): API calls and display rules. The screens are in skills.tsx.

// The same six values, in the same order, as backend/src/routes/skills.ts; the list shows the
// groups in this order.
const skillCategories = [
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
  /** 1 to 5 (#34). What each step means is decided with the form (#45). */
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

/** The highest proficiency step. */
export const maxProficiency = 5;

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

/** "숙련도 5점 중 4점": the proficiency read out in full. */
export const proficiencyText = (proficiency: number) =>
  `숙련도 ${maxProficiency}점 중 ${proficiency}점`;

const base = '/api/skills';

export const skillApi = {
  list: () => requestJson<{ skills: Skill[] }>(base),
};
