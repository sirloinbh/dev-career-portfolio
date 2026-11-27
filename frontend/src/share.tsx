import { Copy } from 'lucide-react';
import { useState } from 'react';

import { type Career, careerList } from './career-data';
import { type Certification, certificationList } from './certification-data';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { type Education, educationList } from './education-data';
import { apiKey, useApiMutation } from './lib/query';
import { useListQuery } from './list-query';
import { PageHeader } from './page-header';
import { type Project, projectList } from './project-data';
import { formatDate } from './service-date';
import {
  shareApi,
  type ShareKind,
  shareKinds,
  shareKindTitles,
  shareLinksPath,
  shareUrl,
  useShareLinks,
} from './share-data';

// The share screen (#236): pick items, create a link, copy it once, and turn links off. The public page is in share-page.tsx.

const names = {
  careers: (c: Career) => c.company,
  projects: (p: Project) => p.name,
  educations: (e: Education) => e.school,
  certifications: (c: Certification) => c.name,
} satisfies Record<ShareKind, (row: never) => string>;

export function ShareScreen() {
  const lists = {
    careers: useListQuery(careerList).rows ?? [],
    projects: useListQuery(projectList).rows ?? [],
    educations: useListQuery(educationList).rows ?? [],
    certifications: useListQuery(certificationList).rows ?? [],
  };
  const links = useShareLinks();
  const [label, setLabel] = useState('');
  const [picked, setPicked] = useState<Record<ShareKind, number[]>>({
    careers: [],
    projects: [],
    educations: [],
    certifications: [],
  });
  const [created, setCreated] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'status' | 'error'; text: string } | undefined>();
  const invalidate = [apiKey(shareLinksPath)];

  const create = useApiMutation<Awaited<ReturnType<typeof shareApi.create>>, void>(
    () => ({ path: shareLinksPath, body: { label, ...picked } }),
    {
      invalidate,
      onSuccess: ({ token }) => {
        setCreated(shareUrl(window.location.origin, token));
        setLabel('');
        setPicked({ careers: [], projects: [], educations: [], certifications: [] });
        setMessage(undefined);
      },
      onError: (error) => setMessage({ kind: 'error', text: error.message }),
    },
  );
  const revoke = useApiMutation<unknown, number>(
    (id) => ({ path: `${shareLinksPath}/${String(id)}/revoke` }),
    {
      invalidate,
      onSuccess: () => setMessage({ kind: 'status', text: 'The link is turned off.' }),
      onError: (error) => setMessage({ kind: 'error', text: error.message }),
    },
  );

  const toggle = (kind: ShareKind, id: number, checked: boolean) =>
    setPicked((now) => ({
      ...now,
      [kind]: checked ? [...now[kind], id] : now[kind].filter((x) => x !== id),
    }));
  const none = shareKinds.every((kind) => picked[kind].length === 0);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMessage({ kind: 'status', text: 'Link copied.' });
    } catch {
      setMessage({ kind: 'error', text: 'Could not copy. Select the link and copy it by hand.' });
    }
  }

  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <PageHeader
        title="Share"
        description="Make a read-only link to chosen items. Anyone with the link can open it without signing in; turn it off any time."
      />
      <Notice notice={message} />
      {created ? (
        <div className="flex flex-col gap-2 rounded-xl border p-4">
          <p className="text-body-sm font-medium">
            Your link. It is shown only now, so copy it before you leave this page.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              aria-label="Share link"
              value={created}
              onFocus={(e) => e.target.select()}
            />
            <Button type="button" variant="outline" onClick={() => void copy(created)}>
              <Copy aria-hidden />
              Copy
            </Button>
          </div>
        </div>
      ) : null}
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="share-label">Name of the link (only you see it)</Label>
          <Input
            id="share-label"
            value={label}
            maxLength={100}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {shareKinds.map((kind) => {
            const rows = lists[kind] as { id: number }[];
            const name = names[kind] as (row: unknown) => string;
            return (
              <fieldset key={kind} className="flex flex-col gap-2 rounded-xl border p-4">
                <legend className="px-1 text-body-sm font-medium">{shareKindTitles[kind]}</legend>
                {rows.length === 0 ? (
                  <p className="text-caption text-muted-foreground">Nothing added yet.</p>
                ) : (
                  rows.map((row) => (
                    <label key={row.id} className="flex items-center gap-2 text-body-sm">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={picked[kind].includes(row.id)}
                        onChange={(e) => toggle(kind, row.id, e.target.checked)}
                      />
                      <span className="wrap-anywhere break-keep">{name(row)}</span>
                    </label>
                  ))
                )}
              </fieldset>
            );
          })}
        </div>
        <div>
          <Button type="submit" disabled={label.trim() === '' || none || create.isPending}>
            Create link
          </Button>
        </div>
      </form>
      <section aria-labelledby="share-links-title" className="flex flex-col gap-3">
        <h2 id="share-links-title">Links</h2>
        {links.isError ? (
          <Notice notice={{ kind: 'error', text: 'Could not load the links.' }} />
        ) : !links.data ? (
          <SkeletonList rows={2} />
        ) : links.data.shareLinks.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">No links yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.data.shareLinks.map((link) => (
              <li
                key={link.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-body-sm font-medium wrap-anywhere">{link.label}</span>
                  <span className="text-caption text-muted-foreground">
                    {shareKinds
                      .filter((kind) => link.counts[kind] > 0)
                      .map((kind) => `${shareKindTitles[kind]} ${String(link.counts[kind])}`)
                      .join(' · ')}
                    {' · '}
                    {link.revokedAt
                      ? 'Turned off'
                      : `Created ${formatDate(link.createdAt.slice(0, 10))}`}
                  </span>
                </div>
                {link.revokedAt ? null : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Turn off ${link.label}`}
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(link.id)}
                  >
                    Turn off
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
