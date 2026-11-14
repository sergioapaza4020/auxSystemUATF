import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStudentAttendanceCheckIn } from './useStudentAttendanceCheckIn';
import { deferred, hookHarness } from '@/test-utils/hook-harness';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import type {
  IMyAttendanceSession,
  IMyAttendanceSessionsResponse,
} from '@/interfaces/attendances/student-attendance.interface';

const mocks = vi.hoisted(() => ({ list: vi.fn(), post: vi.fn(), locate: vi.fn(), academic: vi.fn() }));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/api/attendances.service', () => ({ getMyAttendanceSessions: mocks.list, checkInAttendance: mocks.post }));

const open: IMyAttendanceSession = {
  idAttendanceSession: 7,
  date: '2026-10-27',
  startsAt: '2026-10-27T13:00:00Z',
  endsAt: '2026-10-27T15:00:00Z',
  state: 'OPEN',
  isComputable: false,
  alreadyRegistered: false,
  ownStatus: null,
  ownMarkedAt: null,
};

const envelope = (data: IMyAttendanceSession[] = [open]): IMyAttendanceSessionsResponse => ({
  data,
  meta: { limit: 20, hasMore: false, upcomingUntil: '2026-10-28T14:00:00Z' },
});

const result = {
  code: 'SUCCESS',
  idAttendance: 1,
  status: AttendanceStatus.PRESENT,
  registrationMethod: 'GEOLOCATION',
  markedAt: '2026-10-27T14:00:00Z',
};

const error = (code: string, status = 409) => ({
  isAxiosError: true,
  response: { status, data: { code, message: 'Internal details with location must stay hidden' } },
});

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockReset();
  mocks.post.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T14:00:00Z'));
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: mocks.locate } });
  mocks.list.mockResolvedValue(envelope());
  mocks.post.mockResolvedValue(result);
  mocks.academic.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function setup(id: number | null = 20) {
  let currentId = id;
  const h = hookHarness(() => useStudentAttendanceCheckIn(currentId, mocks.academic));

  cleanups.push(h.unmount);
  h.render();
  await flush();
  h.render();

  return {
    ...h,
    changeEnrollment: (value: number | null) => {
      currentId = value;
      h.render();
    },
  };
}

function gpsSuccess() {
  (mocks.locate.mock.calls.at(-1)?.[0] as PositionCallback)({
    coords: { latitude: -19.572312345, longitude: -65.755123456, accuracy: 18.123 },
  } as GeolocationPosition);
}

function gpsError(code: number) {
  (mocks.locate.mock.calls.at(-1)?.[1] as PositionErrorCallback)({ code } as GeolocationPositionError);
}

describe('student attendance check-in', () => {
  it('replaces uncertainty with confirmed information after a later manual refresh', async () => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' });
    mocks.list.mockRejectedValueOnce(new Error('offline'));
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    mocks.list.mockResolvedValueOnce(
      envelope([{ ...open, alreadyRegistered: true, ownStatus: AttendanceStatus.PRESENT }]),
    );
    await h.render().reload();
    expect(h.render().feedback?.severity).toBe('info');
    expect(h.render().blockedIds).toEqual([]);
    expect(h.render().sessions[0].alreadyRegistered).toBe(true);
  });
  it('never lets an older GET replace verification after a timed-out POST', async () => {
    const h = await setup();
    const stale = deferred<IMyAttendanceSessionsResponse>();

    mocks.list.mockReturnValueOnce(stale.promise);
    const oldRefresh = h.render().reload();

    mocks.post.mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNABORTED' });
    mocks.list.mockResolvedValueOnce(
      envelope([{ ...open, alreadyRegistered: true, ownStatus: AttendanceStatus.PRESENT }]),
    );
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    stale.resolve(envelope());
    await oldRefresh;
    expect(h.render().sessions[0].alreadyRegistered).toBe(true);
    expect(mocks.list).toHaveBeenCalledTimes(3);
  });
  it('does not assert success or final failure when a fresh lookup has no mark after timeout', async () => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNABORTED' });
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(h.render().feedback?.severity).toBe('warning');
    expect(h.render().sessions[0].alreadyRegistered).toBe(false);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('reconciles a timed-out POST with a confirmed server mark before allowing another attempt', async () => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce({ isAxiosError: true, code: 'ECONNABORTED' });
    mocks.list.mockResolvedValueOnce(
      envelope([
        { ...open, alreadyRegistered: true, ownStatus: AttendanceStatus.PRESENT, ownMarkedAt: result.markedAt },
      ]),
    );
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(h.render().sessions[0].alreadyRegistered).toBe(true);
    expect(h.render().feedback?.severity).toBe('info');
    await h.render().checkIn(7);
    expect(mocks.locate).toHaveBeenCalledTimes(1);
  });
  it('keeps an uncertain POST blocked when verification also fails', async () => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce({ isAxiosError: true, code: 'ERR_NETWORK' });
    mocks.list.mockRejectedValueOnce(new Error('offline'));
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(h.render().blockedIds).toContain(7);
    expect(h.render().feedback?.severity).toBe('warning');
    await h.render().checkIn(7);
    expect(mocks.locate).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('keeps a stale OPEN button blocked if a closed-session refresh fails', async () => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce(error('SESSION_CLOSED'));
    mocks.list.mockRejectedValueOnce(new Error('network'));
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(h.render().blockedIds).toContain(7);
    await h.render().checkIn(7);
    expect(mocks.locate).toHaveBeenCalledTimes(1);
  });
  it('refreshes SESSION_NOT_STARTED and follows the returned scheduled state', async () => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce(error('SESSION_NOT_STARTED'));
    mocks.list.mockResolvedValueOnce(envelope([{ ...open, state: 'SCHEDULED' }]));
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(h.render().sessions[0].state).toBe('SCHEDULED');
    await h.render().checkIn(7);
    expect(mocks.locate).toHaveBeenCalledTimes(1);
  });
  it('cleans the transition timer on unmount', async () => {
    const h = await setup();

    h.unmount();
    await vi.advanceTimersByTimeAsync(7200000);
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.locate).not.toHaveBeenCalled();
  });
  it('aborts an in-flight POST and ignores its late response on unmount', async () => {
    const h = await setup();
    const pending = deferred<typeof result>();

    mocks.post.mockReturnValueOnce(pending.promise);
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await flush();
    const signal = mocks.post.mock.calls[0][2] as AbortSignal;

    h.unmount();
    expect(signal.aborted).toBe(true);
    pending.resolve(result);
    await operation;
    expect(mocks.academic).not.toHaveBeenCalled();
  });
  it('loads once on mount and never automatically requests location', async () => {
    const h = await setup();

    h.render();
    h.render();
    expect(mocks.list).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledWith(20, expect.any(AbortSignal));
    expect(mocks.locate).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it.each([null, 0, -1, NaN, Infinity])('does not fetch invalid enrollment %s', async (id) => {
    await setup(id);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('captures once, posts only the raw three coordinates, then updates local state and both summaries', async () => {
    const h = await setup();
    const operation = h.render().checkIn(7);

    expect(h.render().phase).toBe('OBTAINING_LOCATION');
    expect(mocks.post).not.toHaveBeenCalled();
    gpsSuccess();
    await operation;
    const state = h.render();

    expect(mocks.locate).toHaveBeenCalledTimes(1);
    expect(mocks.locate).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    expect(mocks.post).toHaveBeenCalledWith(
      7,
      { latitude: -19.572312345, longitude: -65.755123456, accuracy: 18.123 },
      expect.any(AbortSignal),
    );
    expect(state.sessions[0]).toMatchObject({
      alreadyRegistered: true,
      ownStatus: 'PRESENT',
      ownMarkedAt: result.markedAt,
    });
    expect(state.feedback?.severity).toBe('success');
    expect(state.phase).toBe('IDLE');
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.academic).toHaveBeenCalledOnce();
    expect(state).not.toHaveProperty('position');
    expect(state).not.toHaveProperty('latitude');
    await state.checkIn(7);
    expect(mocks.locate).toHaveBeenCalledTimes(1);
  });
  it.each([1, 2, 3])('browser error %s never posts and allows an explicit retry', async (code) => {
    const h = await setup();
    const operation = h.render().checkIn(7);

    gpsError(code);
    await operation;
    expect(h.render().feedback?.severity).toBe('error');
    expect(h.render().phase).toBe('IDLE');
    expect(mocks.post).not.toHaveBeenCalled();
    const retry = h.render().checkIn(7);

    gpsError(code);
    await retry;
    expect(mocks.locate).toHaveBeenCalledTimes(2);
  });
  it('handles unsupported geolocation without a POST', async () => {
    vi.stubGlobal('navigator', {});
    const h = await setup();

    await h.render().checkIn(7);
    expect(h.render().feedback?.message).toContain('Contacta al auxiliar');
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it.each(['OUTSIDE_AREA', 'LOW_ACCURACY', 'LOCATION_INVALID'])(
    '%s keeps retry available and never presents success',
    async (code) => {
      const h = await setup();

      mocks.post.mockRejectedValueOnce(error(code, 422));
      const operation = h.render().checkIn(7);

      gpsSuccess();
      await operation;
      expect(h.render().feedback?.severity).toBe('error');
      expect(h.render().feedback?.message).not.toContain('Internal');
      expect(h.render().sessions[0].alreadyRegistered).toBe(false);
      const retry = h.render().checkIn(7);

      gpsSuccess();
      await retry;
      expect(mocks.locate).toHaveBeenCalledTimes(2);
    },
  );
  it('ALREADY_REGISTERED is final without inventing PRESENT for a possible manual absence', async () => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce(error('ALREADY_REGISTERED'));
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(h.render().feedback?.severity).toBe('info');
    expect(h.render().sessions[0]).toMatchObject({ alreadyRegistered: true, ownStatus: null });
    await h.render().checkIn(7);
    expect(mocks.locate).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
  it.each([
    'SESSION_CLOSED',
    'SESSION_CANCELLED',
    'SESSION_NOT_FOUND',
    'SESSION_NOT_GEOLOCATION',
    'SESSION_CONTEXT_INVALID',
    'NOT_ENROLLED',
  ])('%s refetches and removes an unavailable session', async (code) => {
    const h = await setup();

    mocks.post.mockRejectedValueOnce(error(code));
    mocks.list.mockResolvedValueOnce(envelope([]));
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(h.render().sessions).toEqual([]);
    expect(h.render().feedback?.severity).toBe('error');
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });
  it('blocks double clicks during both GPS capture and POST', async () => {
    const h = await setup();
    const pending = deferred<typeof result>();

    mocks.post.mockReturnValueOnce(pending.promise);
    const operation = h.render().checkIn(7);

    await h.render().checkIn(7);
    expect(mocks.locate).toHaveBeenCalledTimes(1);
    gpsSuccess();
    await flush();
    expect(h.render().phase).toBe('CHECKING_IN');
    await h.render().checkIn(7);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    pending.resolve(result);
    await operation;
  });
  it('ignores a late GPS callback after unmount without posting or storing it', async () => {
    const h = await setup();
    const operation = h.render().checkIn(7);

    h.unmount();
    gpsSuccess();
    await operation;
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('does not post the old location when the enrollment changes', async () => {
    const h = await setup();
    const operation = h.render().checkIn(7);

    h.changeEnrollment(21);
    gpsSuccess();
    await operation;
    expect(mocks.post).not.toHaveBeenCalled();
    await flush();
    expect(h.render().feedback).toBeNull();
  });
  it.each(['SCHEDULED', 'OPEN'] as const)(
    'refetches once at the %s boundary without deciding the next state locally',
    async (state) => {
      const initial = { ...open, state, startsAt: '2026-10-27T14:01:00Z', endsAt: '2026-10-27T14:02:00Z' };

      mocks.list.mockResolvedValueOnce(envelope([initial])).mockResolvedValue(envelope([]));
      const h = await setup();

      await vi.advanceTimersByTimeAsync(state === 'SCHEDULED' ? 60500 : 120500);
      h.render();
      expect(mocks.list).toHaveBeenCalledTimes(2);
      expect(mocks.academic).toHaveBeenCalledOnce();
      await vi.advanceTimersByTimeAsync(3600000);
      expect(mocks.list).toHaveBeenCalledTimes(2);
      expect(mocks.locate).not.toHaveBeenCalled();
    },
  );
  it('does not capture in scheduled or already registered sessions', async () => {
    mocks.list.mockResolvedValueOnce(
      envelope([
        { ...open, state: 'SCHEDULED' },
        { ...open, idAttendanceSession: 8, alreadyRegistered: true },
      ]),
    );
    const h = await setup();

    await h.render().checkIn(7);
    await h.render().checkIn(8);
    expect(mocks.locate).not.toHaveBeenCalled();
  });
  it('preserves confirmed success when a refresh fails', async () => {
    const h = await setup();

    mocks.list.mockRejectedValueOnce(new Error('network'));
    const operation = h.render().checkIn(7);

    gpsSuccess();
    await operation;
    expect(h.render().sessions[0].alreadyRegistered).toBe(true);
    expect(h.render().feedback?.severity).toBe('warning');
    expect(mocks.academic).toHaveBeenCalledOnce();
  });
});
