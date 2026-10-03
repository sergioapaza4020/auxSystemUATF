import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IUserImportExecution, UserImportExecutionStatus } from '@/interfaces/users/user-import.interface';
import { pollUserImport } from './userImportPolling';

const state = (status: UserImportExecutionStatus): IUserImportExecution => ({
  operationId: 'op',
  status,
  total: 100,
  processed: 70,
  failed: 5,
  progress: 75,
  startedAt: null,
  completedAt: null,
});

afterEach(() => vi.useRealTimers());

describe('User import polling', () => {
  it.each<UserImportExecutionStatus>(['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'EXPIRED'])(
    'stops at %s and preserves real progress',
    async (terminal) => {
      vi.useFakeTimers();
      const fetch = vi.fn().mockResolvedValueOnce(state('IMPORTING')).mockResolvedValue(state(terminal));
      const onStatus = vi.fn();
      const stop = pollUserImport(fetch, onStatus, vi.fn());

      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(10000);
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(onStatus).toHaveBeenLastCalledWith(state(terminal));
      stop();
    },
  );
  it('never overlaps slow requests and aborts/ignores results after unmount', async () => {
    vi.useFakeTimers();
    let resolve: ((value: IUserImportExecution) => void) | undefined;

    const fetch = vi.fn(
      (signal: AbortSignal) =>
        new Promise<IUserImportExecution>((done) => {
          if (!signal.aborted) resolve = done;
        }),
    );

    const onStatus = vi.fn();
    const stop = pollUserImport(fetch, onStatus, vi.fn());

    await vi.advanceTimersByTimeAsync(20000);
    expect(fetch).toHaveBeenCalledTimes(1);
    stop();
    expect(fetch.mock.calls[0][0].aborted).toBe(true);
    resolve?.(state('COMPLETED'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(onStatus).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retains polling after a temporary status error and cleans up scheduled requests', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(state('IMPORTING'));
    const onError = vi.fn();
    const stop = pollUserImport(fetch, vi.fn(), onError);

    await vi.advanceTimersByTimeAsync(2000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
