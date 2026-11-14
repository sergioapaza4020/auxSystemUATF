import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAttendanceQr } from './useAttendanceQr';
import { getAttendanceQrCode } from '@/api/attendances.service';
import type { IAttendanceQrCode, AttendanceSessionState } from '@/interfaces/attendances/attendance.interface';
import { hookHarness, deferred } from '@/test-utils/hook-harness';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/api/attendances.service', () => ({ getAttendanceQrCode: vi.fn() }));
const get = vi.mocked(getAttendanceQrCode);
const now = Date.parse('2026-11-12T14:00:00Z');

const code = (id = 7, offset = 0): IAttendanceQrCode => ({
  idAttendanceSession: id,
  token: `q1.synthetic-${id}-${offset}`,
  serverNow: new Date(now + offset).toISOString(),
  rotateAt: new Date(now + offset + 30000).toISOString(),
  expiresAt: new Date(now + offset + 35000).toISOString(),
});

const cleanups: (() => void)[] = [];
let events: EventTarget;

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(now);
  events = new EventTarget();
  vi.stubGlobal('window', events);
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  get.mockResolvedValue(code());
});
afterEach(() => {
  cleanups.splice(0).forEach((close) => close());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(state: AttendanceSessionState = 'OPEN') {
  let id = 7;
  let enabled = true;
  const terminal = vi.fn();
  const h = hookHarness(() => useAttendanceQr({ idAttendanceSession: id, mode: 'QR', state }, enabled, terminal));

  cleanups.push(h.unmount);
  h.render();

  return {
    ...h,
    terminal,
    setId: (value: number) => {
      id = value;
    },
    close: () => {
      enabled = false;
    },
  };
}

describe('Auxiliary QR requests, rotation and privacy', () => {
  it.each(['DRAFT', 'SCHEDULED', 'CLOSED', 'CANCELLED'] as const)('does not obtain a code for %s', (state) => {
    const h = setup(state);

    expect(h.render().code).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
  it('fetches once, counts down locally and replaces the QR at rotateAt', async () => {
    const h = setup();

    expect(h.render().code).toBeNull();
    await flush();
    expect(h.render().code?.token).toBe(code().token);
    await vi.advanceTimersByTimeAsync(29000);
    expect(h.render().remaining).toBe(1);
    expect(get).toHaveBeenCalledTimes(1);
    get.mockResolvedValue(code(7, 30000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(get).toHaveBeenCalledTimes(2);
    expect(h.render().code?.token).toBe(code(7, 30000).token);
  });
  it('keeps a valid old QR while replacing it and hides it at expiry on network failure', async () => {
    const h = setup();

    await flush();
    const next = deferred<IAttendanceQrCode>();

    get.mockReturnValue(next.promise);
    await vi.advanceTimersByTimeAsync(30000);
    expect(h.render().fetching).toBe(true);
    expect(h.render().code).not.toBeNull();
    next.reject(new Error('offline'));
    await flush();
    expect(h.render().error).toBe('No se pudo actualizar el código QR.');
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.render().code).toBeNull();
    expect(get).toHaveBeenCalledTimes(2);
    get.mockResolvedValue({ ...code(7, 30000), serverNow: new Date(now + 35000).toISOString() });
    h.render().retry();
    h.render().retry();
    await flush();
    expect(get).toHaveBeenCalledTimes(3);
    expect(h.render().code).not.toBeNull();
  });
  it('aborts and ignores a response from a different selected session', async () => {
    const old = deferred<IAttendanceQrCode>();

    get.mockReturnValueOnce(old.promise);
    const h = setup();
    const signal = get.mock.calls[0][1]!;

    h.setId(8);
    get.mockResolvedValue(code(8));
    expect(h.render().code).toBeNull();
    await flush();
    old.resolve(code());
    await flush();
    expect(signal.aborted).toBe(true);
    expect(h.render().code?.idAttendanceSession).toBe(8);
  });
  it('cleans pending requests and timers when closing and obtains a fresh code on reopening', async () => {
    const pending = deferred<IAttendanceQrCode>();

    get.mockReturnValueOnce(pending.promise);
    const h = setup();
    const signal = get.mock.calls[0][1]!;

    h.close();
    h.render();
    pending.resolve(code());
    await flush();
    expect(signal.aborted).toBe(true);
    expect(h.render().code).toBeNull();
    await vi.advanceTimersByTimeAsync(60000);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('withdraws immediately after a terminal server response and stops rotation', async () => {
    const h = setup();

    await flush();
    get.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { code: 'SESSION_CLOSED' } } });
    await vi.advanceTimersByTimeAsync(30000);
    expect(h.render().code).toBeNull();
    expect(h.terminal).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60000);
    expect(get).toHaveBeenCalledTimes(2);
  });
  it('does not trust a clock jump or revive a token when focus returns', async () => {
    const h = setup();

    await flush();
    get.mockResolvedValue({ ...code(7, 30000), serverNow: new Date(now + 36000).toISOString() });
    vi.setSystemTime(now + 36000);
    events.dispatchEvent(new Event('focus'));
    expect(h.render().code).toBeNull();
    await flush();
    expect(get).toHaveBeenCalledTimes(2);
    expect(h.render().code?.token).toBe(code(7, 30000).token);
  });
  it('rejects an envelope for another session without displaying its token', async () => {
    get.mockResolvedValue(code(88));
    const h = setup();

    await flush();
    expect(h.render().code).toBeNull();
    expect(h.render().error).not.toContain(code(88).token);
  });
  it('never persists tokens or writes them to console', async () => {
    const write = vi.fn();

    vi.stubGlobal('localStorage', { setItem: write });
    vi.stubGlobal('sessionStorage', { setItem: write });
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const h = setup();

    await flush();
    h.close();
    h.render();
    expect(write).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });
});
