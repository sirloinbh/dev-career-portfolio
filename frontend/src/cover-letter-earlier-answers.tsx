import { Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from './components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { SkeletonList } from './components/ui/skeleton';
import { type EarlierAnswer, useEarlierAnswers } from './cover-letter-data';
import { errorText } from './lib/use-notice';

// "Find earlier answers" (#231): search the questions and answers of other applications and copy one
// into the answer field. Nothing is saved until the user saves the form.

function Matches({
  text,
  applicationId,
  onPick,
}: {
  text: string;
  applicationId: string;
  onPick: (match: EarlierAnswer) => void;
}) {
  const result = useEarlierAnswers(text, applicationId);
  if (result.isPending) return <SkeletonList rows={2} />;
  if (result.isError) {
    return (
      <p role="alert" className="text-body-sm text-destructive">
        Could not search. {errorText(result.error)}
      </p>
    );
  }
  const { matches } = result.data;
  if (matches.length === 0) {
    return <p className="text-body-sm text-muted-foreground">No earlier answers match “{text}”.</p>;
  }
  return (
    <ul aria-label="Earlier answers" className="flex flex-col gap-3">
      {matches.map((match) => (
        <li key={match.id} className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-caption text-muted-foreground">
            {match.companyName}
            {match.position ? ` · ${match.position}` : ''} · {match.date}
          </p>
          <p className="text-body-sm font-medium break-keep">{match.question}</p>
          <p className="line-clamp-4 text-body-sm break-keep whitespace-pre-wrap">{match.answer}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            aria-label={`Use this answer from ${match.companyName}: ${match.question}`}
            onClick={() => onPick(match)}
          >
            Use this answer
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function FindEarlierAnswers({
  applicationId,
  label,
  onPick,
}: {
  applicationId: string;
  /** Names the question the answer is for, so each button is told apart. */
  label: string;
  /** Called with the chosen answer's text; the dialog closes after it. */
  onPick: (answer: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [searched, setSearched] = useState('');
  const search = () => setSearched(typed.trim());
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          aria-label={`Find earlier answers for ${label}`}
        >
          <Search aria-hidden />
          Find earlier answers
        </Button>
      </DialogTrigger>
      {/* The dialog sits inside the form in the React tree: keep its typing and Enter from reaching the form. */}
      <DialogContent onChange={(e) => e.stopPropagation()} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find earlier answers</DialogTitle>
          <DialogDescription>
            Searches the questions and answers of your other applications. The answer you choose is
            copied into the field; it is saved only when you save the questions.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="earlier-answers-search">Search text</Label>
          <div className="flex gap-2">
            <Input
              id="earlier-answers-search"
              value={typed}
              maxLength={100}
              autoComplete="off"
              placeholder="e.g. motivation"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  search();
                }
              }}
            />
            <Button type="button" onClick={search} disabled={typed.trim() === ''}>
              Search
            </Button>
          </div>
        </div>
        <div aria-live="polite">
          {searched === '' ? null : (
            <Matches
              key={searched}
              text={searched}
              applicationId={applicationId}
              onPick={(match) => {
                onPick(match.answer);
                setOpen(false);
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
