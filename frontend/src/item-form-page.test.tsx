import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, test, vi } from 'vitest';

import { toast, Toaster } from './components/ui/sonner';
import { EditItemPage, NewItemPage } from './item-form-page';
import { findLive, queryLive } from './test/live';

// The shell every New and Edit screen uses, tested once with a stand-in form (the entities test their own fields).

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

type Form = { name: string };
type Row = { id: number; name: string };

function Fields({
  initial,
  submitLabel,
  cancelTo,
  onSubmit,
}: {
  initial: Form;
  submitLabel: string;
  cancelTo: string;
  onSubmit: (form: Form) => Promise<unknown>;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(initial).catch(() => undefined);
      }}
    >
      <p>{`Form for ${initial.name || 'nobody'}`}</p>
      <button type="submit">{submitLabel}</button>
      <a href={cancelTo}>Cancel</a>
    </form>
  );
}

const paths = { list: '/things' };
const texts = { noun: 'thing', backLabel: 'Thing list' };
const rows: Row[] = [{ id: 3, name: 'Alpha' }];

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(path: string, element: React.ReactNode) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/things/new" element={element} />
        <Route path="/things/:id/edit" element={element} />
        <Route path="/things" element={<h1>Things</h1>} />
      </Routes>
      <Where />
      <Toaster />
    </MemoryRouter>,
  );
}

const edit = (overrides: Partial<Parameters<typeof EditItemPage<Form, Row>>[0]> = {}) => (
  <EditItemPage<Form, Row>
    paths={paths}
    texts={texts}
    loadItems={() => Promise.resolve(rows)}
    toForm={(row) => ({ name: row.name })}
    update={() => Promise.resolve()}
    Fields={Fields}
    {...overrides}
  />
);

test('New shows the title and the back link, saves, and returns to the list', async () => {
  const create = vi.fn(() => Promise.resolve('Alpha'));
  renderAt(
    '/things/new',
    <NewItemPage<Form>
      paths={paths}
      texts={texts}
      description="Name is all you need."
      initial={{ name: '' }}
      create={create}
      Fields={Fields}
    />,
  );
  expect(screen.getByRole('heading', { level: 1, name: 'Add thing' })).toBeInTheDocument();
  expect(screen.getByText('Name is all you need.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Thing list/ })).toHaveAttribute('href', '/things');
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Things' })).toBeInTheDocument();
  expect(create).toHaveBeenCalledWith({ name: '' });
  expect(await screen.findByText("Added 'Alpha'")).toBeInTheDocument();
});

test('Edit finds the row in the list, fills the form, saves it and returns to the list', async () => {
  const update = vi.fn(() => Promise.resolve());
  renderAt('/things/3/edit', edit({ update }));
  expect(screen.getByRole('heading', { level: 1, name: 'Edit thing' })).toBeInTheDocument();
  expect(await screen.findByText('Form for Alpha')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { level: 1, name: 'Things' })).toBeInTheDocument();
  expect(update).toHaveBeenCalledWith(rows[0], { name: 'Alpha' });
  expect(await screen.findByText('Saved')).toBeInTheDocument();
});

test('a failed save stays on the page and shows no success message', async () => {
  const update = vi.fn(() => Promise.reject(new Error('nope')));
  renderAt('/things/3/edit', edit({ update }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save' }));
  await vi.waitFor(() => expect(update).toHaveBeenCalled());
  expect(screen.getByTestId('where')).toHaveTextContent('/things/3/edit');
  expect(screen.queryByText('Saved')).not.toBeInTheDocument();
});

test('a row that is not in the list says it may be deleted', async () => {
  renderAt('/things/9/edit', edit());
  expect(await findLive('alert')).toHaveTextContent('Thing not found. It may already be deleted.');
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
});

test('a list that cannot be loaded says so with the reason', async () => {
  renderAt(
    '/things/3/edit',
    edit({ loadItems: () => Promise.reject(new Error('Cannot connect')) }),
  );
  expect(await findLive('alert')).toHaveTextContent('Could not load thing. Cannot connect');
});

test('a malformed id is an invalid address, not a missing row, and loads nothing', async () => {
  renderAt('/things/abc/edit', edit());
  expect(await findLive('alert')).toHaveTextContent('This address is not valid');
  expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  expect(queryLive('status')).toBeNull();
});
