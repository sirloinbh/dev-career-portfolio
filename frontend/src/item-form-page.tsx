import type { ComponentType } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Notice } from './components/ui/notice';
import { PageHeader } from './components/ui/page-header';
import { SkeletonList } from './components/ui/skeleton';
import { toast } from './components/ui/sonner';
import { invalidAddressText, isValidId } from './entity-id';
import { errorText } from './lib/use-notice';
import { type ListQuery, useListQuery, useRefreshList } from './list-query';

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
  listPath,
  description,
  initial,
  create,
  Fields,
}: {
  paths: { list: string };
  texts: Texts;
  /** The list's API path, refreshed after the save so the list shows the new row. */
  listPath: string;
  /** What the person must fill in. */
  description: string;
  initial: Form;
  /** Saves the form and returns the name shown in "Added '…'". */
  create: (form: Form) => Promise<string>;
  Fields: ComponentType<FormProps<Form>>;
}) {
  const navigate = useNavigate();
  const refresh = useRefreshList(listPath);
  const onSubmit = async (form: Form) => {
    const name = await create(form);
    toast.success(`Added '${name}'`);
    await refresh();
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" className="flex flex-col gap-6">
      <PageHeader
        title={`Add ${texts.noun}`}
        description={description}
        backTo={{ to: paths.list, label: texts.backLabel }}
      />
      <Fields initial={initial} submitLabel="Add" cancelTo={paths.list} onSubmit={onSubmit} />
    </section>
  );
}

export function EditItemPage<Form, Item extends { id: number }>({
  paths,
  texts,
  list,
  toForm,
  update,
  Fields,
}: {
  paths: { list: string };
  texts: Texts;
  /** The list the row is found in (a module-level constant from the entity's `*-data.ts`). */
  list: ListQuery<Item>;
  toForm: (item: Item) => Form;
  update: (item: Item, form: Form) => Promise<unknown>;
  Fields: ComponentType<FormProps<Form>>;
}) {
  const { id = '' } = useParams();
  const valid = isValidId(id);
  // There is no single-item API: the list is small, so the form finds its row there. It is the list screen's cache
  // entry, so coming from the list shows the form at once.
  const { query, rows } = useListQuery(list, { enabled: valid });
  const refresh = useRefreshList(list.path);
  const navigate = useNavigate();
  const loading = valid && query.isPending;
  const item = rows?.find((row) => String(row.id) === id);
  const onSubmit = async (form: Form) => {
    if (!item) return;
    await update(item, form);
    toast.success('Saved');
    await refresh();
    void navigate(paths.list);
  };
  return (
    <section aria-labelledby="page-title" aria-busy={loading} className="flex flex-col gap-6">
      <PageHeader
        title={`Edit ${texts.noun}`}
        description="Change what you need, then save."
        backTo={{ to: paths.list, label: texts.backLabel }}
      />
      {/* Always mounted, so screen readers hear the text appear and go. */}
      <p role="status" className="sr-only">
        {loading ? `Loading ${texts.noun}` : ''}
      </p>
      {!valid ? <Notice notice={{ kind: 'error', text: invalidAddressText }} /> : null}
      {loading ? <SkeletonList rows={4} /> : null}
      {valid && query.isError && !item ? (
        <Notice
          notice={{
            kind: 'error',
            text: `Could not load ${texts.noun}. ${errorText(query.error)}`,
          }}
        />
      ) : null}
      {valid && query.isSuccess && !item ? (
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
