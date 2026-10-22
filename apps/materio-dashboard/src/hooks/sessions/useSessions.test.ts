import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllSessions } from '@/api/sessions.service';
import { hookHarness } from '@/test-utils/hook-harness';
import { useSessions } from './useSessions';
import type { PaginatedApiResponse } from '@/interfaces/apiResponse';
import type { ISession } from '@/interfaces/sessions/session.interface';

vi.mock('@/api/sessions.service', () => ({ getAllSessions: vi.fn() }));
vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));

const response = (page: number, total = 11, active = true): PaginatedApiResponse<ISession[]> => ({
  status: true,
  statusCode: 200,
  data: [{ idSession: 7, isActive: active }] as ISession[],
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

describe('Session pagination after remote revocation', () => {
  it('refetches the same page and shows the retained inactive session', async () => {
    vi.mocked(getAllSessions)
      .mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce(response(2))
      .mockResolvedValueOnce(response(2, 11, false));
    const harness = hookHarness(useSessions);

    unmount = harness.unmount;
    harness.render();
    await vi.runAllTimersAsync();
    harness.render().changeQuery({ page: 2 });
    harness.render();
    await vi.runAllTimersAsync();
    harness.render().load();
    harness.render();
    await vi.runAllTimersAsync();
    expect(getAllSessions).toHaveBeenLastCalledWith({ page: 2, limit: 5 }, expect.any(AbortSignal));
    expect(harness.render().sessions[0].isActive).toBe(false);
    expect(harness.render().meta.total).toBe(11);
  });

  it('corrects an out-of-range page if the remote total decreases', async () => {
    vi.mocked(getAllSessions)
      .mockResolvedValueOnce(response(1))
      .mockResolvedValueOnce(response(3))
      .mockResolvedValueOnce(response(3, 10))
      .mockResolvedValueOnce(response(2, 10));
    const harness = hookHarness(useSessions);

    unmount = harness.unmount;
    harness.render();
    await vi.runAllTimersAsync();
    harness.render().changeQuery({ page: 3 });
    harness.render();
    await vi.runAllTimersAsync();
    harness.render().load();
    harness.render();
    await vi.runAllTimersAsync();
    harness.render();
    await vi.runAllTimersAsync();
    expect(harness.render().meta.page).toBe(2);
    expect(getAllSessions).toHaveBeenLastCalledWith({ page: 2, limit: 5 }, expect.any(AbortSignal));
  });
});
