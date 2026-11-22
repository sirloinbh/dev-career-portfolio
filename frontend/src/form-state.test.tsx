import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test, vi } from 'vitest';

import { flatFieldOf, typedDate, useServerForm } from './form-state';
import { RequestError } from './lib/api';
import { findLive, queryLive } from './test/live';

// The error placement rules every item form shares, tested once with a stand-in form (the entities test
// their own fields). The page order is memo, then name, so it differs from the order the server lists them.

const empty = { name: '', memo: '', tags: '' };
const fieldOf = flatFieldOf(empty);

function Stand({ save, conflictField }: { save: () => Promise<unknown>; conflictField?: 'name' }) {
  const form = useServerForm(fieldOf, { conflictField });
  return (
    <form onSubmit={form.submit(save)} onChange={form.clearOnEdit}>
      <label htmlFor={form.fieldId('memo')}>Memo</label>
      <input id={form.fieldId('memo')} {...form.describe('memo')} />
      {form.errorFor('memo')}
      <label htmlFor={form.fieldId('name')}>Name</label>
      <input id={form.fieldId('name')} {...form.describe('name')} />
      {form.errorFor('name')}
      <label htmlFor={form.fieldId('tags')}>Tags</label>
      <input id={form.fieldId('tags')} {...form.describe('tags')} />
      {form.errorFor('tags')}
      {form.actions({ submitLabel: 'Save', cancelTo: '/' })}
    </form>
  );
}

const fail = (error: unknown) => vi.fn(() => Promise.reject(error));
const invalid = (...fields: { path: string; message: string }[]) =>
  new RequestError('Check the input', 400, 'http', fields);

function submitStand(save: () => Promise<unknown>, conflictField?: 'name') {
  render(
    <MemoryRouter>
      <Stand save={save} conflictField={conflictField} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
}

test('a message goes under the field its path names and ties to it with aria', async () => {
  submitStand(fail(invalid({ path: 'name', message: 'Name is required' })));
  const name = screen.getByLabelText('Name');
  expect(await screen.findByText('Name is required')).toBeInTheDocument();
  expect(name).toHaveAttribute('aria-invalid', 'true');
  expect(name).toHaveAccessibleDescription('Name is required');
  expect(screen.getByLabelText('Memo')).not.toHaveAttribute('aria-invalid');
  expect(queryLive('alert')).toBeNull();
});

test('a path below a field, such as one list item, belongs to that field', async () => {
  submitStand(
    fail(invalid({ path: 'tags.3', message: 'Tags items must be at most 50 characters' })),
  );
  expect(screen.getByLabelText('Tags')).not.toHaveAttribute('aria-invalid');
  expect(await screen.findByText('Tags items must be at most 50 characters')).toBeInTheDocument();
  expect(screen.getByLabelText('Tags')).toHaveAccessibleDescription(
    'Tags items must be at most 50 characters',
  );
});

test('a path that names no field goes to the notice, the other messages stay under their fields', async () => {
  submitStand(
    fail(
      invalid(
        { path: 'name', message: 'Name is required' },
        { path: 'period', message: 'End date cannot be earlier than start date' },
      ),
    ),
  );
  expect(await findLive('alert')).toHaveTextContent('End date cannot be earlier than start date');
  expect(screen.getByText('Name is required')).toBeInTheDocument();
});

test('focus goes to the first field in page order, not the first the server listed', async () => {
  submitStand(
    fail(
      invalid(
        { path: 'name', message: 'Name is required' },
        { path: 'memo', message: 'Memo must be at most 2000 characters' },
      ),
    ),
  );
  await screen.findByText('Name is required');
  await waitFor(() => expect(screen.getByLabelText('Memo')).toHaveFocus());
});

test('the same message twice for a field shows once; different messages are joined', async () => {
  submitStand(
    fail(
      invalid(
        { path: 'name', message: 'Name is required' },
        { path: 'name', message: 'Name is required' },
        { path: 'memo', message: 'Memo is too long' },
        { path: 'memo', message: 'Memo has a bad character' },
      ),
    ),
  );
  await screen.findByText('Name is required');
  expect(screen.getByText('Name is required').textContent).toBe('Name is required');
  expect(screen.getByText('Memo is too long, Memo has a bad character')).toBeInTheDocument();
});

test('a 409 goes under the conflict field when the form has one', async () => {
  submitStand(fail(new RequestError('That name is already taken', 409)), 'name');
  expect(await screen.findByText('That name is already taken')).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('That name is already taken');
  expect(queryLive('alert')).toBeNull();
  await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
});

test('a 409 on a form without a conflict field goes to the notice', async () => {
  submitStand(fail(new RequestError('That name is already taken', 409)));
  expect(await findLive('alert')).toHaveTextContent('That name is already taken');
  expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
});

test('a 400 without field paths goes to the notice', async () => {
  submitStand(fail(new RequestError('Request body must be a JSON object', 400)));
  expect(await findLive('alert')).toHaveTextContent('Request body must be a JSON object');
  expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
});

test('an error that is not a request error goes to the notice with its own text', async () => {
  submitStand(fail(new TypeError('Failed to fetch')));
  expect(await findLive('alert')).toHaveTextContent('Failed to fetch');
});

test('anything thrown that is not an Error shows the generic message', async () => {
  submitStand(fail('boom'));
  expect(await findLive('alert')).toHaveTextContent('Could not save');
});

test('a notice-only failure gives focus back to the Save button', async () => {
  submitStand(fail(new TypeError('Failed to fetch')));
  await findLive('alert');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus());
});

test('while saving the button is busy and disabled; a new submit clears the old messages', async () => {
  let reject: (error: unknown) => void = () => undefined;
  const save = vi
    .fn<() => Promise<unknown>>()
    .mockImplementationOnce(() =>
      Promise.reject(invalid({ path: 'name', message: 'Name is required' })),
    )
    .mockImplementationOnce(() => new Promise((_, rejectSave) => (reject = rejectSave)));
  submitStand(save);
  await screen.findByText('Name is required');
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('button', { name: /Save/ })).toBeDisabled());
  expect(screen.getByRole('button', { name: /Save/ })).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  reject(new TypeError('Failed to fetch'));
  expect(await findLive('alert')).toHaveTextContent('Failed to fetch');
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('editing a field clears only its own message, so a fixed text never keeps a message', async () => {
  submitStand(
    fail(
      invalid(
        { path: 'name', message: 'Name is required' },
        { path: 'memo', message: 'Memo is too long' },
      ),
    ),
  );
  await screen.findByText('Name is required');
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'x' } });
  expect(screen.queryByText('Name is required')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  expect(screen.getByText('Memo is too long')).toBeInTheDocument();
  expect(screen.getByLabelText('Memo')).toHaveAttribute('aria-invalid', 'true');
});

test('a successful save leaves no message', async () => {
  const save = vi.fn(() => Promise.resolve());
  submitStand(save);
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(queryLive('alert')).toBeNull();
  expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
});

test('flatFieldOf maps the first path segment to a form key and nothing else', () => {
  expect(fieldOf('name')).toBe('name');
  expect(fieldOf('tags.3')).toBe('tags');
  expect(fieldOf('period')).toBeUndefined();
  expect(fieldOf('')).toBeUndefined();
  // Inherited names are not form keys.
  expect(fieldOf('toString')).toBeUndefined();
  expect(fieldOf('constructor.name')).toBeUndefined();
});

test('typedDate sends text the server refuses for a half-typed date, but not for a disabled input', () => {
  const input = (badInput: boolean, disabled = false) =>
    ({ disabled, validity: { badInput } }) as HTMLInputElement;
  expect(typedDate(input(true), '')).toBe('incomplete');
  expect(typedDate(input(false), '2023-12-01')).toBe('2023-12-01');
  expect(typedDate(input(false), '')).toBe('');
  expect(typedDate(input(true, true), '2023-12-01')).toBe('2023-12-01');
  expect(typedDate(null, '2023-12-01')).toBe('2023-12-01');
});
