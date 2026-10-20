import type * as React from 'react';

import { beforeEach, afterEach, expect, it, vi } from 'vitest';

import { hookHarness, deferred } from '@/test-utils/hook-harness';
import type { ImportPreviewPage, ImportPreviewQuery } from '@/interfaces/import-preview.interface';
import { useImportPreview } from './useImportPreview';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
type Row = { row: number; ru: string };

const first: ImportPreviewPage<Row> = {
  operationId: 'operation-id',
  total: 60,
  valid: 59,
  invalid: 1,
  data: [{ row: 2, ru: '1' }],
  meta: { page: 1, limit: 25, total: 60, totalPages: 3 },
};

const load = vi.fn<(id: string, query: ImportPreviewQuery, signal?: AbortSignal) => Promise<ImportPreviewPage<Row>>>();
const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  load.mockImplementation(async (_id, query) => ({
    ...first,
    data: [{ row: query.page * 25 + 2, ru: '2' }],
    meta: { ...first.meta, page: query.page, limit: query.limit },
  }));
});
afterEach(() => {
  cleanups.splice(0).forEach((clean) => clean());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mount() {
  const h = hookHarness(() => useImportPreview(first, true, load));

  cleanups.push(h.unmount);

  return h;
}

it('adopts the POST page without GET and later queries remotely, keeping global summary unchanged', async () => {
  const h = mount();

  expect(h.render().rows).toEqual(first.data);
  await vi.runAllTimersAsync();
  expect(load).not.toHaveBeenCalled();
  h.render().changeQuery({ page: 2 });
  h.render();
  await vi.runAllTimersAsync();
  expect(load).toHaveBeenLastCalledWith(
    'operation-id',
    { page: 2, limit: 25, search: '', status: 'all' },
    expect.any(AbortSignal),
  );
  expect(h.render().meta.total).toBe(60);
  expect(first.total).toBe(60);
  expect(first.invalid).toBe(1);
  h.render().changeQuery({ limit: 50 });
  h.render();
  await vi.runAllTimersAsync();
  expect(h.render().query.page).toBe(1);
  h.render().changeQuery({ status: 'invalid' });
  h.render();
  await vi.runAllTimersAsync();
  expect(load.mock.calls.at(-1)?.[1].status).toBe('invalid');
});
it('debounces search and ignores stale responses, preserving the current page on errors and allowing retry', async () => {
  const h = mount();

  h.render();
  const slow = deferred<ImportPreviewPage<Row>>();

  load.mockReturnValueOnce(slow.promise);
  h.render().changeQuery({ page: 2 });
  h.render();
  await vi.runAllTimersAsync();
  h.render().changeQuery({ search: 'Ana' });
  h.render();
  await vi.advanceTimersByTimeAsync(349);
  expect(load).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1);
  slow.resolve({ ...first, data: [{ row: 999, ru: 'old' }] });
  await vi.runAllTimersAsync();
  expect(h.render().rows[0].row).not.toBe(999);
  expect(h.render().query.page).toBe(1);
  load.mockRejectedValueOnce(new Error('Offline'));
  h.render().changeQuery({ page: 2 });
  h.render();
  await vi.runAllTimersAsync();
  expect(h.render().error).toContain('Offline');
  expect(h.render().rows).not.toEqual([]);
  h.render().reload();
  h.render();
  await vi.runAllTimersAsync();
  expect(h.render().error).toBe('');
});
