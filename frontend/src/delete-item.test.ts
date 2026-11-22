import { beforeEach, expect, test, vi } from 'vitest';

import { toast } from './components/ui/sonner';
import { deleteItem } from './delete-item';
import { RequestError } from './lib/api';

vi.mock('./components/ui/sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

const run = (remove: () => Promise<unknown>) =>
  deleteItem({ remove, noun: 'career', name: 'Dawn Lab' });

test('a successful delete says what was deleted', async () => {
  await run(() => Promise.resolve());
  expect(toast.success).toHaveBeenCalledWith("Deleted 'Dawn Lab'");
  expect(toast.error).not.toHaveBeenCalled();
});

test('a row that is already gone (404) counts as deleted', async () => {
  await run(() => Promise.reject(new RequestError('Career not found', 404)));
  expect(toast.success).toHaveBeenCalledWith("Deleted 'Dawn Lab'");
  expect(toast.error).not.toHaveBeenCalled();
});

test('any other failure shows the reason and rethrows so the dialog stays open', async () => {
  const failure = new RequestError('Server error', 500);
  await expect(run(() => Promise.reject(failure))).rejects.toBe(failure);
  expect(toast.error).toHaveBeenCalledWith('Could not delete the career. Server error');
  expect(toast.success).not.toHaveBeenCalled();
});

test('an unreachable server is a failure, not a 404', async () => {
  await expect(run(() => Promise.reject(new TypeError('Failed to fetch')))).rejects.toThrow(
    'Failed to fetch',
  );
  expect(toast.error).toHaveBeenCalledWith('Could not delete the career. Failed to fetch');
});
