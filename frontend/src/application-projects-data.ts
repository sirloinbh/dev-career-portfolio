import { requestJson } from './lib/api';
import { apiKey, useApiQuery } from './lib/query';

// The projects an application highlights (#234): API calls. The section is in application-projects.tsx.

export const applicationProjectsPath = (applicationId: string | number) =>
  `/api/applications/${encodeURIComponent(String(applicationId))}/projects`;

type Highlighted = { projectIds: number[] };

export const applicationProjectsApi = {
  read: (applicationId: string | number) =>
    requestJson<Highlighted>(applicationProjectsPath(applicationId)),
  save: (applicationId: string | number, projectIds: number[]) =>
    requestJson<Highlighted>(applicationProjectsPath(applicationId), {
      method: 'PUT',
      body: { projectIds },
    }),
};

/** The ids of the projects one application highlights, newest project first. */
export function useHighlightedProjects(applicationId: string, enabled: boolean) {
  return useApiQuery<Highlighted>(
    apiKey(applicationProjectsPath(applicationId)),
    applicationProjectsPath(applicationId),
    { enabled },
  );
}
