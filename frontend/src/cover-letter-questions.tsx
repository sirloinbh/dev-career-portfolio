import { ListOrdered, Pencil } from 'lucide-react';
import { Link, useParams } from 'react-router';

import {
  type Application,
  applicationList,
  type ApplicationPaths,
  applicationStatusLabels,
  applicationStatusVariant,
  deadlineText,
} from './application-data';
import { StatusHistory } from './application-status-history';
import { Badge } from './components/ui/badge';
import { Button } from './components/ui/button';
import { EmptyState } from './components/ui/empty-state';
import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { answerLengthText, type CoverLetterQuestion, useQuestions } from './cover-letter-data';
import { invalidAddressText, isValidId } from './entity-id';
import { errorText } from './lib/use-notice';
import { useListQuery } from './list-query';
import { BackLink, PageHeader } from './page-header';
import { serviceToday } from './service-date';

/** Status, position, and deadline of the application the questions belong to. */
function ApplicationSummary({ application }: { application: Application }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-body-sm">
      <Badge variant={applicationStatusVariant[application.status]}>
        {applicationStatusLabels[application.status]}
      </Badge>
      {application.position ? (
        <span className="wrap-anywhere break-keep">{application.position}</span>
      ) : null}
      {/* Read once per render: the countdown follows the service date, not the device's time zone. */}
      <span className="text-muted-foreground">{deadlineText(application, serviceToday())}</span>
    </div>
  );
}

function QuestionItem({ question, number }: { question: CoverLetterQuestion; number: number }) {
  const titleId = `question-${question.id}`;
  return (
    <li aria-labelledby={titleId} className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-1">
        <p className="text-caption font-medium text-muted-foreground">Question {number}</p>
        {/* A question can run to several lines (500 characters), so its line breaks are kept. */}
        <h2
          id={titleId}
          className="text-body font-semibold wrap-break-word break-keep whitespace-pre-line"
        >
          {question.question}
        </h2>
      </div>
      {question.answer ? (
        <p className="text-body-sm wrap-break-word break-keep whitespace-pre-line">
          {question.answer}
        </p>
      ) : (
        <p className="text-body-sm text-muted-foreground">No answer yet</p>
      )}
      <p className="text-caption text-muted-foreground">{answerLengthText(question)}</p>
    </li>
  );
}

export function ApplicationQuestions({ paths }: { paths: ApplicationPaths }) {
  const { id = '' } = useParams();
  const valid = isValidId(id);
  // Keyed by the id in the address, so another application's questions are never kept on screen.
  const questions = useQuestions(id, valid);
  // There is no single-item API (#36): the list is small, so the page finds its row there (the list screen's cache).
  const { rows: applications } = useListQuery(applicationList);
  const application = applications?.find((item) => String(item.id) === id);
  const loading = valid && questions.isPending;
  const missing = valid && questions.isError && questions.error.status === 404;
  const loaded = valid && questions.data !== undefined;
  const list = loaded ? (questions.data?.questions ?? []) : [];

  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <BackLink to={paths.list} label="Application list" />
      <PageHeader
        title={application?.companyName ?? 'Cover letter questions'}
        description="Cover letter questions and answers for this application, in the order they were saved."
      >
        {application ? <ApplicationSummary application={application} /> : null}
        {/* Always mounted, so screen readers hear the text change from loading to the count. */}
        <p role="status" className="sr-only">
          {loading ? 'Loading questions' : ''}
          {loaded ? `${String(list.length)} ${list.length === 1 ? 'question' : 'questions'}` : ''}
        </p>
      </PageHeader>
      {missing || !valid ? null : <StatusHistory applicationId={id} enabled />}
      {missing || !valid ? null : (
        <Button asChild className="w-fit">
          <Link to={paths.editQuestions(id)}>
            <Pencil aria-hidden />
            Edit questions
          </Link>
        </Button>
      )}
      {!valid ? <Notice notice={{ kind: 'error', text: invalidAddressText }} /> : null}
      {loading ? <SkeletonList rows={3} /> : null}
      {missing ? (
        <Notice
          notice={{ kind: 'error', text: 'Application not found. It may already be deleted.' }}
        />
      ) : null}
      {valid && questions.isError && !missing ? (
        // Say what failed first: a proxy error without a server message only carries the generic text.
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load the questions. ${errorText(questions.error)}`,
          }}
        />
      ) : null}
      {loaded && list.length === 0 ? (
        <EmptyState
          className="break-keep"
          icon={<ListOrdered />}
          title="No questions yet"
          description="Choose Edit questions to write them. They appear here in their saved order."
        />
      ) : null}
      {list.length > 0 ? (
        <ol
          aria-label="Question list"
          className="flex flex-col divide-y rounded-xl border bg-card text-card-foreground shadow-sm"
        >
          {list.map((question, index) => (
            <QuestionItem key={question.id} question={question} number={index + 1} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}
