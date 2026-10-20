import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnrollmentsPage } from '@/api/enrollments.service';
import { getAllSessions } from '@/api/sessions.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { ISession } from '@/interfaces/sessions/session.interface';
import type { PaginatedApiResponse } from '@/interfaces/apiResponse';
import { deferred, hookHarness } from '@/test-utils/hook-harness';
import { useEnrollmentsPage } from './enrollments/useEnrollmentsPage';
import { useSessions } from './sessions/useSessions';

vi.mock('@/api/enrollments.service', () => ({ getEnrollmentsPage: vi.fn() }));
vi.mock('@/api/sessions.service', () => ({ getAllSessions: vi.fn() }));
vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));

type Page = PaginatedApiResponse<(IEnrollment & ISession)[]>;

const response = (page = 1, limit = 20, total = 60, id = page): Page => ({
  status: true,
  statusCode: 200,
  data: [{ idEnrollment: id, idSession: id } as IEnrollment & ISession],
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
});

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe.each([
  { name: 'Enrollments', api: vi.mocked(getEnrollmentsPage), usePage: () => useEnrollmentsPage(true), limit: 20 },
  {
    name: 'Sessions',
    api: vi.mocked(getAllSessions),
    usePage: () => {
      const result = useSessions();

      return { ...result, rows: result.sessions, reload: result.load };
    },
    limit: 5,
  },
])('$name remote pagination', ({ api, usePage, limit }) => {
  const mount = () => {
    const harness = hookHarness<ReturnType<typeof usePage>>(usePage);

    cleanups.push(harness.unmount);

    return harness;
  };

  it('loads the initial page and changes to page 2 without requesting page 1 again', async () => {
    api.mockResolvedValueOnce(response(1, limit)).mockResolvedValueOnce(response(2, limit));
    const harness = mount();

    harness.render();
    await vi.runAllTimersAsync();
    harness.render().changeQuery({ page: 2 });
    harness.render();
    await vi.runAllTimersAsync();
    const result = harness.render();

    expect(api.mock.calls.map(([query]) => query.page)).toEqual([1, 2]);
    expect(result.meta.total).toBe(60);
    expect(result.meta.page).toBe(2);
    expect(result.rows).toEqual(response(2, limit).data);
  });

  it('resets to page 1 when the page size changes', async () => {
    api.mockResolvedValue(response(2, limit));
    const harness = mount();

    harness.render().changeQuery({ page: 2 });
    harness.render();
    await vi.runAllTimersAsync();
    harness.render().changeQuery({ limit: 25 });
    harness.render();
    await vi.runAllTimersAsync();
    expect(api).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 25 }), expect.any(AbortSignal));
  });

  it('cancels obsolete requests and ignores their responses even if cancellation is not honored by the transport', async () => {
    const old = deferred<Page>();

    api.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(2, limit));
    const harness = mount();

    harness.render();
    await vi.runAllTimersAsync();
    const signal = api.mock.calls[0][1];

    harness.render().changeQuery({ page: 2 });
    harness.render();
    await vi.runAllTimersAsync();
    expect(signal?.aborted).toBe(true);
    old.resolve(response(1, limit));
    await vi.runAllTimersAsync();
    expect(harness.render().meta.page).toBe(2);
    expect(harness.render().rows).toEqual(response(2, limit).data);
  });

  it('clamps a page made invalid by a smaller result set without looping', async () => {
    api.mockResolvedValueOnce(response(4, limit, limit + 1)).mockResolvedValueOnce(response(2, limit, limit + 1));
    const harness = mount();

    harness.render().changeQuery({ page: 4 });
    harness.render();
    await vi.runAllTimersAsync();
    harness.render();
    await vi.runAllTimersAsync();
    expect(harness.render().meta.page).toBe(2);
    expect(api.mock.calls.map(([query]) => query.page)).toEqual([4, 2]);
  });

  it('preserves rows and stops loading after an error', async () => {
    api.mockResolvedValueOnce(response(1, limit)).mockRejectedValueOnce(new Error('Failed request'));
    const harness = mount();

    harness.render();
    await vi.runAllTimersAsync();
    harness.render().changeQuery({ page: 2 });
    harness.render();
    await vi.runAllTimersAsync();
    expect(harness.render().rows).toEqual(response(1, limit).data);
    expect(harness.render().loading).toBe(false);
    expect(harness.render().error).not.toBe('');
  });

  it('aborts the current request on unmount', async () => {
    api.mockReturnValueOnce(deferred<Page>().promise);
    const harness = mount();

    harness.render();
    await vi.runAllTimersAsync();
    harness.unmount();
    expect(api.mock.calls[0][1]?.aborted).toBe(true);
  });
});

it('Enrollments applies explicit search/status changes on page 1', async () => {
  vi.mocked(getEnrollmentsPage).mockResolvedValue(response());
  const harness = hookHarness(() => useEnrollmentsPage(true));

  cleanups.push(harness.unmount);
  harness.render().changeQuery({ page: 2 });
  harness.render();
  await vi.runAllTimersAsync();
  harness.render().changeQuery({ search: ' Ana ', status: 'inactive' });
  harness.render();
  await vi.runAllTimersAsync();
  expect(getEnrollmentsPage).toHaveBeenLastCalledWith(
    { search: 'Ana', status: 'inactive', page: 1, limit: 20 },
    expect.any(AbortSignal),
  );
});
