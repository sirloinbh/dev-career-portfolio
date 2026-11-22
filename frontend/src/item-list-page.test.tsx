import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

import { toast } from './components/ui/sonner';
import { ItemListPage, ItemUl } from './item-list-page';
import { findLive } from './test/live';

type Row = { id: number; name: string };

function setup(load: () => Promise<Row[]>, removeRow = vi.fn(() => Promise.resolve())) {
  render(
    <MemoryRouter>
      <ItemListPage<Row>
        load={load}
        title="Things"
        description="Your things."
        noun="things"
        addLabel="Add thing"
        addTo="/things/new"
        empty={{ icon: null, title: 'No things yet', description: 'Add one.' }}
        deleteNoun="thing"
        deleteName={(row) => row.name}
        removeRow={removeRow}
        renderRows={(rows, onDelete) => (
          <ItemUl label="Thing list">
            {rows.map((row) => (
              <li key={row.id} aria-label={row.name}>
                {row.name}
                <button type="button" onClick={() => void onDelete(row)}>
                  Delete {row.name}
                </button>
              </li>
            ))}
          </ItemUl>
        )}
      />
    </MemoryRouter>,
  );
  return removeRow;
}

const rows: Row[] = [
  { id: 1, name: 'First' },
  { id: 2, name: 'Second' },
];

test('shows a placeholder while loading, then the rows and their count', async () => {
  setup(() => Promise.resolve(rows));
  expect(screen.getByRole('region', { busy: true })).toBeInTheDocument();
  expect(await screen.findByRole('list', { name: 'Thing list' })).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByRole('link', { name: 'Add thing' })).toHaveAttribute('href', '/things/new');
});

test('an empty list explains what will appear', async () => {
  setup(() => Promise.resolve([]));
  expect(await screen.findByRole('heading', { name: 'No things yet' })).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

test('a failed first load says what failed', async () => {
  setup(() => Promise.reject(new Error('Server error')));
  expect(await findLive('alert')).toHaveTextContent('Could not load things.');
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
});

test('deleting removes the row at once and moves focus to the title; a failed reload shows a retry', async () => {
  const load = vi
    .fn<() => Promise<Row[]>>()
    .mockResolvedValueOnce(rows)
    .mockRejectedValueOnce(new Error('down'))
    .mockResolvedValueOnce([rows[1]]);
  const removeRow = setup(load);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete First' }));
  expect(await findLive('alert')).toHaveTextContent(
    'Could not refresh things. The list below may be out of date.',
  );
  expect(removeRow).toHaveBeenCalledWith(rows[0]);
  expect(screen.queryByRole('listitem', { name: 'First' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('list')).getByText('Second')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull());
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  toast.dismiss();
});
