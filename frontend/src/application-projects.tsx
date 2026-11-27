import { useState } from 'react';

import {
  applicationProjectsApi,
  applicationProjectsPath,
  useHighlightedProjects,
} from './application-projects-data';
import { Button } from './components/ui/button';
import { toast } from './components/ui/sonner';
import { errorText } from './lib/use-notice';
import { useListQuery, useRefreshList } from './list-query';
import { projectList } from './project-data';

// The projects an application highlights (#234), on the application page: check the projects to put forward for this
// job. The Resume screen can start from this choice.

export function ApplicationProjects({ applicationId }: { applicationId: string }) {
  const { rows: projects } = useListQuery(projectList);
  const saved = useHighlightedProjects(applicationId, true);
  const refresh = useRefreshList(applicationProjectsPath(applicationId));
  // Until the person changes something, the checks are the saved ones.
  const [picked, setPicked] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const current = picked ?? saved.data?.projectIds ?? [];
  const changed = picked !== null;
  const toggle = (id: number, checked: boolean) =>
    setPicked(checked ? [...current, id] : current.filter((x) => x !== id));

  async function save() {
    setSaving(true);
    setError('');
    try {
      await applicationProjectsApi.save(applicationId, current);
      await refresh();
      setPicked(null);
      toast.success('Saved the highlighted projects');
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="highlighted-projects" className="flex flex-col gap-3">
      <h2 id="highlighted-projects" className="text-body font-semibold">
        Highlighted projects
      </h2>
      <p className="text-caption break-keep text-muted-foreground">
        Check the projects to put forward for this application. The Resume screen can start from
        them.
      </p>
      {!projects || saved.isPending ? (
        <p className="text-body-sm text-muted-foreground">Loading projects</p>
      ) : projects.length === 0 ? (
        <p className="text-body-sm text-muted-foreground">
          Add a project first to highlight it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <label className="flex items-center gap-2 text-body-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={current.includes(project.id)}
                  onChange={(e) => toggle(project.id, e.target.checked)}
                />
                <span className="wrap-anywhere break-keep">{project.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {saved.isError ? (
        <p className="text-body-sm text-destructive">Could not load the highlighted projects.</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="w-fit"
        disabled={!changed || saving}
        onClick={() => void save()}
      >
        {saving ? 'Saving' : 'Save highlighted projects'}
      </Button>
    </section>
  );
}
