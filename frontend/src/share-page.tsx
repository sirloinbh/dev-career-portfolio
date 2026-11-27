import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { careerPeriodText } from './career-data';
import { Spinner } from './components/ui/spinner';
import { degreeLabels, statusLabels } from './education-data';
import { projectPeriodText } from './project-data';
import { formatDate } from './service-date';
import { shareApi, type SharedPortfolio, shareKindTitles } from './share-data';

// The public read-only page (#236). It sits outside the sign-in gate and calls only GET /api/share/:token.

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ok'; data: SharedPortfolio };

function useSharedPortfolio(token: string): State {
  const [state, setState] = useState<State>({ status: 'loading' });
  useEffect(() => {
    let current = true;
    shareApi
      .read(token)
      .then((data) => current && setState({ status: 'ok', data }))
      .catch((error: { status?: number }) => {
        if (current) setState({ status: error.status === 404 ? 'missing' : 'error' });
      });
    return () => {
      current = false;
    };
  }, [token]);
  return state;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section aria-labelledby={`share-${title}`} className="flex flex-col gap-3">
    <h2 id={`share-${title}`}>{title}</h2>
    <ul className="flex flex-col gap-4">{children}</ul>
  </section>
);

const Text = ({ value }: { value: string | null }) =>
  value ? <p className="text-body-sm wrap-anywhere whitespace-pre-line">{value}</p> : null;

function Portfolio({ data }: { data: SharedPortfolio }) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 id="page-title">{data.label}</h1>
        <p className="text-body-sm text-muted-foreground">Shared portfolio, read only.</p>
      </header>
      {data.careers.length > 0 ? (
        <Section title={shareKindTitles.careers}>
          {data.careers.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 rounded-xl border p-4">
              <h3>{c.company}</h3>
              <p className="text-caption text-muted-foreground">
                {[c.position, careerPeriodText(c)].filter(Boolean).join(' · ')}
              </p>
              <Text value={c.duties} />
              <Text value={c.achievements} />
            </li>
          ))}
        </Section>
      ) : null}
      {data.projects.length > 0 ? (
        <Section title={shareKindTitles.projects}>
          {data.projects.map((p) => (
            <li key={p.id} className="flex flex-col gap-1 rounded-xl border p-4">
              <h3>{p.name}</h3>
              <p className="text-caption text-muted-foreground">
                {[p.organization, p.role, projectPeriodText(p)].filter(Boolean).join(' · ')}
              </p>
              <Text value={p.summary} />
              <Text value={p.contributions} />
              {p.skills.length > 0 ? (
                <p className="text-caption">Skills: {p.skills.join(', ')}</p>
              ) : null}
              {p.repositoryUrl || p.serviceUrl ? (
                <p className="text-caption wrap-anywhere">
                  {[p.repositoryUrl, p.serviceUrl].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </li>
          ))}
        </Section>
      ) : null}
      {data.educations.length > 0 ? (
        <Section title={shareKindTitles.educations}>
          {data.educations.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 rounded-xl border p-4">
              <h3>{e.school}</h3>
              <p className="text-caption text-muted-foreground">
                {e.major} · {degreeLabels[e.degree]} · {statusLabels[e.status]} ·{' '}
                {formatDate(e.startDate)} – {e.endDate ? formatDate(e.endDate) : 'Present'}
              </p>
            </li>
          ))}
        </Section>
      ) : null}
      {data.certifications.length > 0 ? (
        <Section title={shareKindTitles.certifications}>
          {data.certifications.map((c) => (
            <li key={c.id} className="flex flex-col gap-1 rounded-xl border p-4">
              <h3>{c.name}</h3>
              <p className="text-caption text-muted-foreground">
                {[c.issuer, formatDate(c.acquiredDate)].filter(Boolean).join(' · ')}
              </p>
            </li>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

export function SharedPortfolioPage() {
  const { token = '' } = useParams();
  const state = useSharedPortfolio(token);
  let body;
  if (state.status === 'ok') body = <Portfolio data={state.data} />;
  else if (state.status === 'loading')
    body = (
      <div aria-busy="true" className="flex items-center gap-2 text-body-sm text-muted-foreground">
        <Spinner size="sm" aria-hidden />
        <p role="status">Loading…</p>
      </div>
    );
  else
    body = (
      <div role="alert" className="flex flex-col gap-1">
        <h1 id="page-title">
          {state.status === 'missing' ? 'This link does not work' : 'Could not load this page'}
        </h1>
        <p className="text-body-sm text-muted-foreground">
          {state.status === 'missing'
            ? 'The link is wrong or has been turned off. Ask the person who sent it for a new one.'
            : 'Check your connection and reload the page.'}
        </p>
      </div>
    );
  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl p-4 sm:p-8" aria-labelledby="page-title">
      {body}
    </main>
  );
}
