import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPendingEmail } from '@/api/account-settings.service';

import { watchPendingEmail } from './pending-email-lifecycle';

vi.mock('@/api/account-settings.service', () => ({ getPendingEmail: vi.fn() }));

describe('vencimiento de cambios de correo', () => {
  const start = new Date('2026-11-26T13:00:00Z');
  const session = 12;
  const active = { newEmail: 'pendiente@example.test', expiresAt: '2026-11-26T13:15:00Z' };
  let focus: EventTarget;
  let visibility: EventTarget & { visibilityState: string };
  let watcher: ReturnType<typeof watchPendingEmail> | undefined;
  const publish = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.resetAllMocks();
    focus = new EventTarget();
    visibility = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('window', focus);
    vi.stubGlobal('document', visibility);
  });

  afterEach(() => {
    watcher?.dispose();
    watcher = undefined;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function startWatching() {
    watcher = watchPendingEmail(session, publish);
    await vi.advanceTimersByTimeAsync(0);

    return watcher;
  }

  it('expires precisely at the deadline without polling and revalidates once', async () => {
    vi.mocked(getPendingEmail).mockResolvedValueOnce(active).mockResolvedValueOnce(null);
    await startWatching();
    expect(publish).toHaveBeenLastCalledWith(active, false);
    await vi.advanceTimersByTimeAsync(899_999);
    expect(getPendingEmail).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(publish).toHaveBeenLastCalledWith(null, false);
    expect(getPendingEmail).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not display an expired response or schedule another timer', async () => {
    vi.setSystemTime(new Date(active.expiresAt));
    vi.mocked(getPendingEmail).mockResolvedValue(active);
    await startWatching();
    expect(publish).toHaveBeenCalledExactlyOnceWith(null, false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears expired state on return from suspension even if revalidation fails', async () => {
    vi.mocked(getPendingEmail).mockResolvedValueOnce(active).mockRejectedValueOnce(new Error('network'));
    await startWatching();
    visibility.visibilityState = 'hidden';
    visibility.dispatchEvent(new Event('visibilitychange'));
    expect(getPendingEmail).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(active.expiresAt));
    visibility.visibilityState = 'visible';
    visibility.dispatchEvent(new Event('visibilitychange'));
    focus.dispatchEvent(new Event('focus'));
    expect(publish).toHaveBeenLastCalledWith(null, false);
    await vi.advanceTimersByTimeAsync(0);
    expect(getPendingEmail).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears requests consumed or invalidated by the server before expiry', async () => {
    vi.mocked(getPendingEmail).mockResolvedValueOnce(active).mockResolvedValueOnce(null);
    await startWatching();
    focus.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(publish).toHaveBeenLastCalledWith(null, false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('replaces the timer on resend and ignores a stale lookup from before submission', async () => {
    let resolveLookup: (value: typeof active) => void = () => undefined;

    vi.mocked(getPendingEmail)
      .mockResolvedValueOnce(active)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveLookup = resolve;
          }),
      )
      .mockResolvedValue(null);
    const tracker = await startWatching();

    await vi.advanceTimersByTimeAsync(60_000);
    focus.dispatchEvent(new Event('focus'));
    tracker.beginSubmission();
    const replacement = { ...active, expiresAt: '2026-11-26T13:16:00Z' };

    tracker.finishSubmission(replacement);
    resolveLookup(active);
    await vi.advanceTimersByTimeAsync(840_000);
    expect(publish).toHaveBeenLastCalledWith(replacement, true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(publish).toHaveBeenLastCalledWith(null, false);
  });

  it('aborts previous-identity lookups and clears lifecycle listeners when disposing', async () => {
    let resolveLookup: (value: typeof active) => void = () => undefined;

    vi.mocked(getPendingEmail).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLookup = resolve;
        }),
    );
    const tracker = await startWatching();

    tracker.dispose();
    resolveLookup(active);
    focus.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.mocked(getPendingEmail).mock.calls[0][1].aborted).toBe(true);
    expect(getPendingEmail).toHaveBeenCalledTimes(1);
    expect(publish).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
