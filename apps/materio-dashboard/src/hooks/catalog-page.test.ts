import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCoursesPage } from '@/api/courses.service';
import { hookHarness, deferred } from '@/test-utils/hook-harness';
import { useCatalogPage } from './useCatalogPage';
import type { ICourse } from '@/interfaces/courses/course.interface';
import type { PaginatedApiResponse } from '@/interfaces/apiResponse';

vi.mock('@/api/courses.service', () => ({ getCoursesPage: vi.fn() }));
vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));

const response = (page = 1, total = 12): PaginatedApiResponse<ICourse[]> => ({
  status: true,
  statusCode: 200,
  data: [{ idCourse: page, code: 'SIS', name: 'Sistemas', group: 1, isActive: true }],
  meta: { page, limit: 5, total, totalPages: Math.ceil(total / 5) },
});

let unmount = () => {};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
});
afterEach(() => {
  unmount();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const mount = () => {
  const h = hookHarness(() => useCatalogPage(getCoursesPage));

  unmount = h.unmount;

  return h;
};

describe('Courses remote pagination', () => {
  it('requests only each remote page and retains server total', async () => {
    vi.mocked(getCoursesPage).mockResolvedValueOnce(response()).mockResolvedValueOnce(response(2));
    const h = mount();

    h.render();
    await vi.runAllTimersAsync();
    expect(h.render().meta.total).toBe(12);
    h.render().changeQuery({ page: 2 });
    h.render();
    await vi.runAllTimersAsync();
    expect(h.render().rows[0].idCourse).toBe(2);
    expect(getCoursesPage).toHaveBeenCalledTimes(2);
    expect(getCoursesPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), expect.any(AbortSignal));
  });
  it.each([{ search: 'SIS' }, { status: 'inactive' as const }, { limit: 25 }])(
    'resets page and queries remotely for %j',
    async (patch) => {
      vi.mocked(getCoursesPage).mockResolvedValue(response());
      const h = mount();

      h.render();
      await vi.runAllTimersAsync();
      h.render().changeQuery({ page: 2 });
      h.render();
      await vi.runAllTimersAsync();
      h.render().changeQuery(patch);
      h.render();
      await vi.runAllTimersAsync();
      expect(getCoursesPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ ...patch, page: 1 }),
        expect.any(AbortSignal),
      );
    },
  );
  it('cancels stale responses and debounces rapid searches', async () => {
    const pending = deferred<PaginatedApiResponse<ICourse[]>>();

    vi.mocked(getCoursesPage).mockReturnValueOnce(pending.promise).mockResolvedValue(response(2));
    const h = mount();

    h.render();
    await vi.runAllTimersAsync();
    const signal = vi.mocked(getCoursesPage).mock.calls[0][1];

    h.render().changeQuery({ search: 'S' });
    h.render();
    h.render().changeQuery({ search: 'SIS' });
    h.render();
    expect(signal?.aborted).toBe(true);
    await vi.runAllTimersAsync();
    pending.resolve(response());
    await Promise.resolve();
    expect(h.render().rows[0].idCourse).toBe(2);
    expect(getCoursesPage).toHaveBeenCalledTimes(2);
  });
  it('clamps a page made invalid by a deletion instead of showing false empty results', async () => {
    vi.mocked(getCoursesPage)
      .mockResolvedValueOnce(response())
      .mockResolvedValueOnce(response(3, 4))
      .mockResolvedValueOnce(response(1, 4));
    const h = mount();

    h.render();
    await vi.runAllTimersAsync();
    h.render().changeQuery({ page: 3 });
    h.render();
    await vi.runAllTimersAsync();
    expect(h.render().query.page).toBe(1);
    h.render();
    await vi.runAllTimersAsync();
    expect(h.render().rows[0].idCourse).toBe(1);
    expect(h.render().meta.total).toBe(4);
  });
  it('exposes loading and an error instead of overwriting it with stale data', async () => {
    vi.mocked(getCoursesPage).mockRejectedValue(new Error('No disponible'));
    const h = mount();

    expect(h.render().loading).toBe(true);
    await vi.runAllTimersAsync();
    expect(h.render()).toMatchObject({ loading: false, error: 'No disponible' });
  });
});
