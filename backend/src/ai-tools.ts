// The AI tools of Dev Career Portfolio (project-standards#711, ADR-0017). shared-ai lists and calls them over
// /internal/tools; standard/tools.ts checks the signed call, the scope, and writes the audit row.
import { z } from 'zod/v4';

import { type Db, listSkills } from './routes/skills.js';
import { defineTool } from './standard/tools.js';

// A tool never returns the whole list at once.
const listInput = z.object({ limit: z.int().min(1).max(200).default(50) });

export const tools = [
  defineTool({
    name: 'list_skills',
    description:
      'List the registered skills (at most 200, default 50) with category, proficiency 1 to 5 and notes, grouped by category, strongest first.',
    input: listInput,
    access: 'read',
    action: 'read',
    entity: 'skill',
    run: async ({ limit }, { db }: { db: Db }) => ({ result: await listSkills(db, limit) }),
  }),
];
