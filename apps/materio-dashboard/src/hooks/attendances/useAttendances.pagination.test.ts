import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAttendanceSession, getAttendanceSessionsByEnrollment } from '@/api/attendances.service';
import type {
  IAttendanceSessionDetail,
  IAttendanceSessionSummary,
} from '@/interfaces/attendances/attendance.interface';
import type { PaginatedApiResponse } from '@/interfaces/apiResponse';
import { deferred, hookHarness } from '@/test-utils/hook-harness';
import { useAttendances } from './useAttendances';

vi.mock('@/api/attendances.service', () => ({
  getAttendanceSessionsByEnrollment: vi.fn(),
  getAttendanceSession: vi.fn(),
  createAttendanceSession: vi.fn(),
  saveAttendances: vi.fn(),
}));
vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));

type Page = PaginatedApiResponse<IAttendanceSessionSummary[]>;

const summary = (id = 1): IAttendanceSessionSummary => ({
  idAttendanceSession: id,
  date: '2026-10-10',
  presentCount: 2,
  excusedCount: 1,
  absentCount: 3,
  totalStudents: 6,
  percentage: 41.667,
});

const response = (page = 1, limit = 5, total = 42): Page => ({
  status: true,
  statusCode: 200,
  data: total ? [summary(page)] : [],
  meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
});

const api = vi.mocked(getAttendanceSessionsByEnrollment);

const flush = async () => {
  for (let index = 0; index < 6; index++) await Promise.resolve();
};

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  api.mockImplementation(async (_, query) => response(query.page, query.limit));
});
afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

const mount = () => {
  const harness = hookHarness(() => useAttendances(20));

  cleanups.push(harness.unmount);

  return harness;
};

describe('Attendance remote history and recent sessions', () => {
  it('requests the history page and only five recent sessions; changing page does not reload the sidebar', async () => {
    const harness = mount();

    harness.render();
    await flush();
    expect(api).toHaveBeenCalledTimes(2);
    expect(api.mock.calls.map(([, query]) => query)).toEqual([
      { page: 1, limit: 5 },
      { page: 1, limit: 5 },
    ]);
    const firstRecent = harness.render().recentSessions;

    harness.render().changeQuery({ page: 2 });
    harness.render();
    await flush();
    expect(api).toHaveBeenCalledTimes(3);
    expect(api).toHaveBeenLastCalledWith(20, { page: 2, limit: 5 }, expect.any(AbortSignal));
    expect(harness.render().meta).toEqual({ page: 2, limit: 5, total: 42, totalPages: 9 });
    expect(harness.render().sessions).toEqual([summary(2)]);
    expect(harness.render().recentSessions).toBe(firstRecent);
  });

  it('resets the history page for page size and date filters', async () => {
    const harness = mount();

    harness.render().changeQuery({ page: 3 });
    harness.render();
    await flush();
    harness.render().changeQuery({ limit: 25 });
    harness.render();
    await flush();
    expect(api).toHaveBeenLastCalledWith(20, { page: 1, limit: 25 }, expect.any(AbortSignal));
    harness.render().changeQuery({ page: 2 });
    harness.render();
    await flush();
    harness.render().changeQuery({ date: '2026-01-01' });
    harness.render();
    await flush();
    expect(api).toHaveBeenLastCalledWith(20, { page: 1, limit: 25, date: '2026-01-01' }, expect.any(AbortSignal));
  });

  it('looks up dates in the backend without replacing the history or active session', async () => {
    const harness = mount();

    harness.render();
    await flush();
    const history = harness.render().sessions;
    const active = { ...summary(100), attendances: [] } as IAttendanceSessionDetail;

    vi.mocked(getAttendanceSession).mockResolvedValueOnce(active);
    api.mockResolvedValueOnce({ ...response(), data: [summary(100)] });
    await harness.render().loadSession(100);
    harness.render();
    const opened = harness.render().session;

    api.mockResolvedValueOnce({ ...response(), data: [summary(80)] });
    expect(await harness.render().findSessionByDate('2020-01-01')).toEqual(summary(80));
    expect(api).toHaveBeenLastCalledWith(20, { page: 1, limit: 1, date: '2020-01-01' }, expect.any(AbortSignal));
    expect(harness.render().sessions).toBe(history);
    harness.render().changeQuery({ page: 2 });
    harness.render();
    await flush();
    expect(harness.render().session).toBe(opened);
    expect(opened?.percentage).toBe(summary(100).percentage);
  });

  it('handles an empty history', async () => {
    api.mockResolvedValue(response(1, 5, 0));
    const harness = mount();

    harness.render();
    await flush();
    expect(harness.render().sessions).toEqual([]);
    expect(harness.render().meta.total).toBe(0);
    expect(harness.render().loading).toBe(false);
  });

  it('leaves mutation refresh feedback to the caller, preserving rows without duplicate errors', async () => {
    const harness = mount();

    harness.render();
    await flush();
    api.mockRejectedValueOnce(new Error('History refresh failed'));
    await expect(harness.render().loadSessions()).rejects.toThrow('History refresh failed');
    expect(harness.render().error).toBe('');
    expect(harness.render().sessions).toEqual([summary(1)]);
  });

  it('does not let a stale history request overwrite page 2', async () => {
    const old = deferred<Page>();

    api.mockReturnValueOnce(old.promise);
    const harness = mount();

    harness.render();
    const signal = api.mock.calls[0][2];

    harness.render().changeQuery({ page: 2 });
    harness.render();
    await flush();
    old.resolve(response(1));
    await flush();
    expect(signal?.aborted).toBe(true);
    expect(harness.render().meta.page).toBe(2);
  });

  it('preserves the existing history and ends loading when a request fails', async () => {
    const harness = mount();

    harness.render();
    await flush();
    api.mockRejectedValueOnce(new Error('Network failed'));
    harness.render().changeQuery({ page: 2 });
    harness.render();
    await flush();
    expect(harness.render().sessions).toEqual([summary(1)]);
    expect(harness.render().loading).toBe(false);
    expect(harness.render().error).not.toBe('');
  });

  it('aborts history and recent requests on unmount', () => {
    api.mockReturnValue(deferred<Page>().promise);
    const harness = mount();

    harness.render();
    harness.unmount();
    expect(api.mock.calls.every(([, , signal]) => signal?.aborted)).toBe(true);
  });
});
