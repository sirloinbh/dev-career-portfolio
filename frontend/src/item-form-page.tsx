import type { ComponentType } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Notice } from './components/ui/notice';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { invalidAddressText, isValidId } from './entity-id';
import { errorText } from './lib/use-notice';
import { BackLink, PageHeader } from './page-header';
import { useLoad } from './use-load';

// The New and Edit screens of every portfolio item share this shell (#144): the back link, the title, the
// loading, error, not-found and invalid-address states of the Edit screen, and the save-then-go-to-the-list step.
// An entity gives its api calls, texts and `Fields` form; it keeps only what differs.

type FormProps<Form> = {
  initial: Form;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: Form) => Promise<unknown>;
};

type Texts = {
  /** The item's name in lower case: "career". */
  noun: string;
  /** The back link: "Career list". */
  backLabel: string;
};

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function NewItemPage<Form>({
  paths,
  texts,
  description,
  initial,
  create,
  Fields,
}: {
  paths: { list: string };
  texts: Texts;
  /** What the person must fill in. */
  description: string;
  initial: Form;
  /** Saves the form and returns the name shown in "Added '…'". */
  create: (form: Form) => Promise<string>;
  Fields: ComponentType<FormProps<Form>>;
}) {
  const navigate = useNavigate();
  const onSubmit = async (form: Form) => {
    toast.success(`Added '${await create(form)}'`);
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <BackLink to={paths.list} label={texts.backLabel} />
      <PageHeader title={`Add ${texts.noun}`} description={description} />
      <Fields initial={initial} submitLabel="Add" cancelTo={paths.list} onSubmit={onSubmit} />
    </section>
  );
}

export function EditItemPage<Form, Item extends { id: number }>({
  paths,
  texts,
  loadItems,
  toForm,
  update,
  Fields,
}: {
  paths: { list: string };
  texts: Texts;
  /** The whole list, in a function that never changes between renders. */
  loadItems: () => Promise<Item[]>;
  toForm: (item: Item) => Form;
  update: (item: Item, form: Form) => Promise<unknown>;
  Fields: ComponentType<FormProps<Form>>;
}) {
  const { id = '' } = useParams();
  const valid = isValidId(id);
  // There is no single-item API: the list is small, so the form finds its row there.
  const loaded = useLoad('all', loadItems);
  const navigate = useNavigate();
  const item = loaded.state === 'ok' ? loaded.data.find((row) => String(row.id) === id) : undefined;
  const onSubmit = async (form: Form) => {
    if (!item) return;
    await update(item, form);
    toast.success('Saved');
    void navigate(paths.list);
  };
  return (
    <section
      aria-labelledby="page-title"
      aria-busy={loaded.state === 'loading'}
      className="flex flex-col gap-6"
    >
      <BackLink to={paths.list} label={texts.backLabel} />
      <PageHeader title={`Edit ${texts.noun}`} description="Change what you need, then save." />
      {!valid ? <Notice notice={{ kind: 'error', text: invalidAddressText }} /> : null}
      {valid && loaded.state === 'loading' ? <SkeletonList rows={4} /> : null}
      {valid && loaded.state === 'error' ? (
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load ${texts.noun}. ${errorText(loaded.error)}`,
          }}
        />
      ) : null}
      {valid && loaded.state === 'ok' && !item ? (
        <Notice
          notice={{
            kind: 'error',
            text: `${capitalized(texts.noun)} not found. It may already be deleted.`,
          }}
        />
      ) : null}
      {item ? (
        <Fields
          // A new id starts a fresh form instead of keeping the previous row's typing.
          key={item.id}
          initial={toForm(item)}
          submitLabel="Save"
          cancelTo={paths.list}
          onSubmit={onSubmit}
        />
      ) : null}
    </section>
  );
}
