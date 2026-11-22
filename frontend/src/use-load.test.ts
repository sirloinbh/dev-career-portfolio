import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';

import { useLoad, useReloading } from './use-load';

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('an inline loader fetches once, not on every render', async () => {
  const load = vi.fn(() => Promise.resolve('data'));
  const { result, rerender } = renderHook(() => useLoad('all', () => load()));
  await waitFor(() => expect(result.current).toEqual({ state: 'ok', data: 'data' }));
  rerender();
  rerender();
  expect(load).toHaveBeenCalledTimes(1);
});

test('a new key shows loading again and ignores the old key’s late answer', async () => {
  const first = deferred<string>();
  const second = deferred<string>();
  const load = vi.fn((key: string) => (key === 'a' ? first.promise : second.promise));
  const { result, rerender } = renderHook(({ id }) => useLoad(id, load), {
    initialProps: { id: 'a' },
  });
  rerender({ id: 'b' });
  expect(result.current).toEqual({ state: 'loading' });
  await act(async () => {
    first.resolve('old');
    await first.promise;
  });
  // The answer for 'a' arrives after the key changed to 'b': it must not show.
  expect(result.current).toEqual({ state: 'loading' });
  await act(async () => {
    second.resolve('new');
    await second.promise;
  });
  expect(result.current).toEqual({ state: 'ok', data: 'new' });
});

test('a rejected load is reported as an error state', async () => {
  const boom = new Error('boom');
  const { result } = renderHook(() => useLoad('all', () => Promise.reject(boom)));
  await waitFor(() => expect(result.current).toEqual({ state: 'error', error: boom }));
});

test('useReloading keeps the data on screen when a reload fails', async () => {
  const load = vi
    .fn<() => Promise<string[]>>()
    .mockResolvedValueOnce(['row'])
    .mockRejectedValueOnce(new Error('down'));
  const { result } = renderHook(() => useReloading('all', load));
  await waitFor(() => expect(result.current.data).toEqual(['row']));
  act(() => result.current.reload());
  await waitFor(() => expect(result.current.loaded.state).toBe('error'));
  expect(result.current.data).toEqual(['row']);
});

test('useReloading applies a change at once, even if the reload then fails', async () => {
  const load = vi
    .fn<() => Promise<string[]>>()
    .mockResolvedValueOnce(['a', 'b'])
    .mockRejectedValueOnce(new Error('down'));
  const { result } = renderHook(() => useReloading('all', load));
  await waitFor(() => expect(result.current.data).toEqual(['a', 'b']));
  act(() => result.current.reload((rows) => rows.filter((row) => row !== 'a')));
  expect(result.current.data).toEqual(['b']);
  await waitFor(() => expect(result.current.loaded.state).toBe('error'));
  expect(result.current.data).toEqual(['b']);
});
