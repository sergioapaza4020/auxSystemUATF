import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useStudentQrAttendance } from './useStudentQrAttendance';
import { deferred, hookHarness } from '@/test-utils/hook-harness';
import { memorySessionStorage, qrContext, qrMark, qrToken } from '@/test-utils/qr-fixtures';
import { QR_PENDING_KEY, qrLoginDestination, savePendingQr } from '@/utils/student-qr-flow';
import type * as BrowserGeolocation from '@/utils/browser-geolocation';
import { BrowserLocationError } from '@/utils/browser-geolocation';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import type { IQrContext, IQrCheckInResult } from '@/interfaces/attendances/student-qr.interface';

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  challenge: vi.fn(),
  combined: vi.fn(),
  location: vi.fn(),
  post: vi.fn(),
  own: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  credentials: true,
  user: null as ICurrentUser | null,
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, loading: false, refreshUser: mocks.refresh, logout: vi.fn() }),
}));
vi.mock('@/api/auth.service', () => ({ hasAuthSessionCookie: vi.fn().mockResolvedValue(false) }));
vi.mock('@/utils/authCookies', () => ({
  getAccessToken: () => (mocks.credentials ? 'fixture-access' : undefined),
  getRefreshToken: () => (mocks.credentials ? 'fixture-refresh' : undefined),
}));
vi.mock('@/api/attendances.service', () => ({
  getQrContext: mocks.context,
  getCombinedChallenge: mocks.challenge,
  checkInCombined: mocks.combined,
  checkInWithQr: mocks.post,
  getMyQrMark: mocks.own,
}));

vi.mock('@/utils/browser-geolocation', async () => ({
  ...(await vi.importActual<typeof BrowserGeolocation>('@/utils/browser-geolocation')),
  getCurrentBrowserPosition: mocks.location,
}));

const student: ICurrentUser = {
  idUser: 5,
  idSession: 1,
  name: 'Ana',
  username: 'ana',
  email: '',
  roles: ['STUDENT'],
  permissions: ['attendance.qr.check-in'],
};

const failure = (code: string, status = 409, headers = {}) => ({
  isAxiosError: true,
  response: { status, data: { code }, headers },
});

const result: IQrCheckInResult = {
  code: 'SUCCESS',
  idAttendance: 2,
  status: 'PRESENT' as IQrCheckInResult['status'],
  registrationMethod: 'QR',
  markedAt: '2026-11-12T14:00:01Z',
};

const cleanups: (() => void)[] = [];
let browser: EventTarget & {
  location: { hash: string; pathname: string; search: string };
  history: { state: object; replaceState: ReturnType<typeof vi.fn> };
  sessionStorage: ReturnType<typeof memorySessionStorage>;
};

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function setup(hash = `#t=${qrToken()}`) {
  browser.location.hash = hash;
  const h = hookHarness(useStudentQrAttendance);

  cleanups.push(h.unmount);
  h.render();

  return h;
}

async function settle(h: ReturnType<typeof setup>) {
  for (let i = 0; i < 5; i++) {
    h.render();
    await flush();
  }

  return h.render();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T14:00:00Z'));
  mocks.user = student;
  mocks.credentials = true;
  mocks.refresh.mockResolvedValue(undefined);
  mocks.context.mockResolvedValue(qrContext());
  mocks.post.mockResolvedValue(result);
  mocks.own.mockResolvedValue({ ownMark: null });
  browser = Object.assign(new EventTarget(), {
    location: { hash: '', pathname: '/attendance/qr', search: '' },
    history: {
      state: { next: 'preserved' },
      replaceState: vi.fn(() => {
        browser.location.hash = '';
      }),
    },
    sessionStorage: memorySessionStorage(),
  });
  vi.stubGlobal('window', browser);
  vi.stubGlobal('localStorage', { setItem: vi.fn(), getItem: vi.fn() });
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: vi.fn(), watchPosition: vi.fn() } });
});
afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('student QR flow', () => {
  it.each(['', '#t=invalid', '#t=' + qrToken() + '&t=' + qrToken()])(
    'never queries or authenticates without an unambiguous token',
    async (hash) => {
      const h = setup(hash);

      expect((await settle(h)).phase).toBe('ERROR');
      expect(mocks.refresh).not.toHaveBeenCalled();
      expect(mocks.context).not.toHaveBeenCalled();
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );
  it('preserves Next history state, strips the fragment and verifies auth before context', async () => {
    const pending = deferred<void>();

    mocks.refresh.mockReturnValueOnce(pending.promise);
    const h = setup();

    h.render();
    await flush();
    expect(mocks.context).not.toHaveBeenCalled();
    expect(browser.history.replaceState).toHaveBeenCalledWith(browser.history.state, '', '/attendance/qr');
    pending.resolve();
    expect((await settle(h)).phase).toBe('READY');
    expect(mocks.context).toHaveBeenCalledWith(7, qrToken(), expect.any(AbortSignal));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(browser.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
  });
  it('returns through ordinary login using only a fixed destination and then adopts the token', async () => {
    mocks.user = null;
    mocks.credentials = false;
    const h = setup();

    await settle(h);
    expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/login');
    expect(mocks.context).not.toHaveBeenCalled();
    h.unmount();
    expect(qrLoginDestination()).toBe('/attendance/qr');
    mocks.user = student;
    mocks.credentials = true;
    const restored = setup('');

    expect((await settle(restored)).phase).toBe('READY');
    expect(browser.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
  });
  it('does not automatically loop back to login after an unsuccessful restored authentication', async () => {
    savePendingQr(qrToken());
    mocks.user = null;
    mocks.credentials = false;
    const h = setup('');

    expect((await settle(h)).phase).toBe('AUTH_REQUIRED');
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('does not create a mark until an explicit click and prevents rapid double submission', async () => {
    const h = setup();

    await settle(h);
    const pending = deferred<IQrCheckInResult>();

    mocks.post.mockReturnValueOnce(pending.promise);
    const first = h.render().confirm();
    const second = h.render().confirm();

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(h.render().phase).toBe('SUBMITTING');
    pending.resolve(result);
    await first;
    await second;
    expect(h.render().phase).toBe('SUCCESS');
    expect(h.render().hasToken).toBe(false);
    await h.render().confirm();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it.each(['QR', 'MANUAL'] as const)('displays the existing %s origin without posting', async (method) => {
    mocks.context.mockResolvedValueOnce({ ...qrContext(), ownMark: { ...qrMark, registrationMethod: method } });
    const h = setup();
    const value = await settle(h);

    expect(value.phase).toBe('ALREADY_REGISTERED');
    expect(value.mark?.registrationMethod).toBe(method);
    expect(value.hasToken).toBe(false);
    await value.confirm();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('preserves an EXCUSED manual exception while reconciling a duplicate', async () => {
    mocks.post.mockRejectedValueOnce(failure('ALREADY_REGISTERED'));
    mocks.own.mockResolvedValueOnce({ ownMark: { ...qrMark, status: 'EXCUSED', registrationMethod: 'MANUAL' } });
    const h = setup();

    await settle(h);
    await h.render().confirm();
    expect(h.render().mark).toMatchObject({ status: 'EXCUSED', registrationMethod: 'MANUAL' });
    expect(mocks.own).toHaveBeenCalledWith(7, expect.any(AbortSignal));
  });
  it('reconciles a lost POST response without retrying the write', async () => {
    mocks.post.mockRejectedValueOnce(new Error('timeout'));
    mocks.own.mockResolvedValueOnce({ ownMark: qrMark });
    const h = setup();

    await settle(h);
    await h.render().confirm();
    expect(h.render().phase).toBe('ALREADY_REGISTERED');
    expect(h.render().mark).toEqual(qrMark);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('keeps a null reconciliation uncertain and only permits another read', async () => {
    mocks.post.mockRejectedValueOnce(new Error('response lost'));
    const h = setup();

    await settle(h);
    await h.render().confirm();
    expect(h.render().phase).toBe('UNCERTAIN');
    expect(h.render().message).toContain('todavía podría');
    await h.render().confirm();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    mocks.own.mockResolvedValueOnce({ ownMark: qrMark });
    await h.render().readOwn();
    expect(h.render().mark).toEqual(qrMark);
  });
  it.each(['QR_TOKEN_EXPIRED', 'QR_TOKEN_INVALID'])(
    'cleans and does not retry a definitively rejected %s',
    async (code) => {
      mocks.post.mockRejectedValueOnce(failure(code, 400));
      const h = setup();

      await settle(h);
      await h.render().confirm();
      expect(h.render().hasToken).toBe(false);
      await h.render().retryContext();
      await h.render().confirm();
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(browser.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
    },
  );
  it('shows expiry after a slow login without extending backend validity', async () => {
    savePendingQr(qrToken());
    mocks.context.mockRejectedValueOnce(failure('QR_TOKEN_EXPIRED', 400));
    const h = setup('');

    expect((await settle(h)).phase).toBe('EXPIRED');
    expect(h.render().message).toContain('Escanea nuevamente');
    expect(h.render().hasToken).toBe(false);
  });
  it('allows safe context retry after a read network error without posting', async () => {
    mocks.context.mockRejectedValueOnce(new Error('offline'));
    const h = setup();

    expect((await settle(h)).phase).toBe('ERROR');
    await h.render().retryContext();
    expect(h.render().phase).toBe('READY');
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it.each(['SESSION_NOT_STARTED', 'SESSION_CANCELLED', 'NOT_ENROLLED', 'SESSION_CONTEXT_INVALID', 'QR_NOT_AVAILABLE'])(
    'shows a controlled %s rejection without a write',
    async (code) => {
      mocks.context.mockRejectedValueOnce(failure(code));
      const h = setup();

      expect((await settle(h)).phase).toBe('ERROR');
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );
  it('retrieves a real own mark after closure', async () => {
    mocks.context.mockRejectedValueOnce(failure('SESSION_CLOSED'));
    mocks.own.mockResolvedValueOnce({ ownMark: qrMark });
    const h = setup();

    expect((await settle(h)).mark).toEqual(qrMark);
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('distinguishes missing permission from expired QR', async () => {
    mocks.user = { ...student, permissions: [] };
    const h = setup();

    expect((await settle(h)).message).toContain('permiso');
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it('respects Retry-After without automatic retries', async () => {
    mocks.context.mockRejectedValueOnce(failure('', 429, { 'retry-after': '10' }));
    const h = setup();

    await settle(h);
    expect(h.render().rateLimited).toBe(true);
    await h.render().retryContext();
    expect(mocks.context).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.render().rateLimited).toBe(false);
    expect(mocks.context).toHaveBeenCalledTimes(1);
    await h.render().retryContext();
    expect(h.render().phase).toBe('READY');
  });
  it('ignores and cancels old context when another QR arrives', async () => {
    const old = deferred<IQrContext>();

    mocks.context.mockReturnValueOnce(old.promise);
    const h = setup();

    await settle(h);
    mocks.context.mockResolvedValue(qrContext(8));
    browser.location.hash = `#t=${qrToken(8)}`;
    browser.dispatchEvent(new Event('hashchange'));
    await settle(h);
    old.resolve(qrContext());
    await flush();
    expect(h.render().context?.idAttendanceSession).toBe(8);
    expect(mocks.context.mock.calls[0][2].aborted).toBe(true);
  });
  it('ignores a late success from a previous QR', async () => {
    const old = deferred<IQrCheckInResult>();
    const h = setup();

    await settle(h);
    mocks.post.mockReturnValueOnce(old.promise);
    const writing = h.render().confirm();

    mocks.context.mockResolvedValue(qrContext(8));
    browser.location.hash = `#t=${qrToken(8)}`;
    browser.dispatchEvent(new Event('hashchange'));
    await settle(h);
    old.resolve(result);
    await writing;
    expect(h.render().phase).toBe('READY');
    expect(h.render().context?.idAttendanceSession).toBe(8);
    expect(h.render().mark).toBeNull();
  });
  it('preserves transfer synchronously before the interceptor redirects after refresh failure', async () => {
    const h = setup();

    await settle(h);
    browser.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    h.unmount();
    expect(qrLoginDestination()).toBe('/attendance/qr');
  });
  it('cleans on voluntary abandonment and bounds memory lifetime', async () => {
    const h = setup();

    await settle(h);
    await vi.advanceTimersByTimeAsync(35000);
    expect(h.render().phase).toBe('EXPIRED');
    expect(h.render().hasToken).toBe(false);
    h.render().abandon();
    expect(mocks.push).toHaveBeenCalledWith('/dashboard');
    expect(browser.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
  });
  it('cancels reads and suppresses updates after unmount', async () => {
    const pending = deferred<IQrContext>();

    mocks.context.mockReturnValueOnce(pending.promise);
    const h = setup();

    await settle(h);
    h.unmount();
    pending.resolve(qrContext());
    await flush();
    expect(mocks.context.mock.calls[0][2].aborted).toBe(true);
    expect(h.render().phase).not.toBe('READY');
  });
  it('clears a previously displayed own mark if a later authorized read returns null', async () => {
    const h = setup();

    await settle(h);
    await h.render().confirm();
    expect(h.render().mark).not.toBeNull();
    await h.render().readOwn();
    expect(h.render().phase).toBe('UNCERTAIN');
    expect(h.render().mark).toBeNull();
  });
  it('never carries academic context or late results across authenticated users', async () => {
    const h = setup();

    await settle(h);
    const pending = deferred<IQrCheckInResult>();

    mocks.post.mockReturnValueOnce(pending.promise);
    const posting = h.render().confirm();
    const context = deferred<IQrContext>();

    mocks.context.mockReturnValueOnce(context.promise);
    mocks.user = { ...student, idUser: 6 };
    h.render();
    expect(h.render().context).toBeNull();
    expect(h.render().mark).toBeNull();
    pending.resolve(result);
    await posting;
    expect(h.render().phase).not.toBe('SUCCESS');
    context.resolve(qrContext());
    await settle(h);
    expect(h.render().phase).toBe('READY');
    expect(h.render().mark).toBeNull();
  });
  it('resumes only an own-mark read when auth expires after an uncertain POST', async () => {
    const h = setup();

    await settle(h);
    mocks.post.mockRejectedValueOnce(new Error('lost response'));
    mocks.own.mockImplementationOnce(async () => {
      browser.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      throw failure('', 401);
    });
    await h.render().confirm();
    h.unmount();
    expect(browser.sessionStorage.getItem(QR_PENDING_KEY)).not.toContain(qrToken());
    expect(qrLoginDestination()).toBe('/attendance/qr');
    mocks.own.mockResolvedValueOnce({ ownMark: qrMark });
    const resumed = setup('');

    await settle(resumed);
    expect(resumed.render().mark).toEqual(qrMark);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.context).toHaveBeenCalledTimes(1);
    expect(browser.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
  });
  it('does not restore READY when context arrives after the local token was discarded', async () => {
    const auth = deferred<void>();
    const context = deferred<IQrContext>();

    mocks.refresh.mockReturnValueOnce(auth.promise);
    mocks.context.mockReturnValueOnce(context.promise);
    const h = setup();

    await settle(h);
    await vi.advanceTimersByTimeAsync(30000);
    auth.resolve();
    await settle(h);
    await vi.advanceTimersByTimeAsync(6000);
    expect(h.render().phase).toBe('EXPIRED');
    context.resolve(qrContext());
    await settle(h);
    expect(h.render().phase).toBe('EXPIRED');
    expect(h.render().hasToken).toBe(false);
  });
  it('never requests location, persists to localStorage or logs the challenge', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const h = setup();

    await settle(h);
    await h.render().confirm();
    expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(navigator.geolocation.watchPosition).not.toHaveBeenCalled();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    log.mockRestore();
    error.mockRestore();
  });
});

const combinedChallenge = (seconds = 90) => ({
  ...qrContext(),
  mode: 'GEOLOCATION_QR' as const,
  serverNow: new Date(Date.now()).toISOString(),
  authorization: 'B'.repeat(43),
  authorizationExpiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
});

async function combinedSetup() {
  mocks.context.mockResolvedValue({ ...qrContext(), mode: 'GEOLOCATION_QR' });
  mocks.challenge.mockResolvedValue(combinedChallenge());
  mocks.location.mockResolvedValue({ latitude: -19.57, longitude: -65.75, accuracy: 25 });
  mocks.combined.mockResolvedValue({ ...result, registrationMethod: 'GEOLOCATION_QR' });
  const h = setup();

  await settle(h);

  return h;
}

describe('combined student flow', () => {
  it('discovers mode first, obtains one challenge, and requires explicit GPS and confirmation', async () => {
    const h = await combinedSetup();

    expect(h.render().phase).toBe('READY_FOR_LOCATION');
    expect(mocks.context).toHaveBeenCalledOnce();
    expect(mocks.challenge).toHaveBeenCalledExactlyOnceWith(7, qrToken(), expect.any(AbortSignal));
    expect(mocks.context.mock.invocationCallOrder[0]).toBeLessThan(mocks.challenge.mock.invocationCallOrder[0]);
    expect(mocks.location).not.toHaveBeenCalled();
    expect(mocks.combined).not.toHaveBeenCalled();
    await h.render().confirm();
    expect(mocks.combined).not.toHaveBeenCalled();
    await h.render().locate();
    expect(h.render().phase).toBe('READY_TO_CONFIRM');
    expect(mocks.combined).not.toHaveBeenCalled();
    const flow = h.render();

    await Promise.all([flow.confirm(), flow.confirm()]);
    expect(mocks.combined).toHaveBeenCalledExactlyOnceWith(
      7,
      { authorization: 'B'.repeat(43), latitude: -19.57, longitude: -65.75, accuracy: 25 },
      expect.any(AbortSignal),
    );
    expect(h.render().phase).toBe('SUCCESS');
    expect(h.render().hasToken).toBe(false);
    expect(browser.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    await h.render().confirm();
    expect(mocks.combined).toHaveBeenCalledOnce();
  });
  it.each(['MANUAL', 'GEOLOCATION', 'UNKNOWN', undefined])('fails closed for unknown entry mode %s', async (mode) => {
    mocks.context.mockResolvedValue({ ...qrContext(), mode });
    const h = setup();

    await settle(h);
    expect(h.render().phase).toBe('ERROR');
    expect(mocks.challenge).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('does not issue a challenge or GPS if a mark already exists', async () => {
    mocks.context.mockResolvedValue({
      ...qrContext(),
      mode: 'GEOLOCATION_QR',
      ownMark: { ...qrMark, registrationMethod: 'MANUAL' },
    });
    const h = setup();

    await settle(h);
    expect(h.render().phase).toBe('ALREADY_REGISTERED');
    expect(h.render().mark?.registrationMethod).toBe('MANUAL');
    expect(mocks.challenge).not.toHaveBeenCalled();
    expect(mocks.location).not.toHaveBeenCalled();
  });
  it('expires at 90 seconds, discards the position, and never renews automatically', async () => {
    const h = await combinedSetup();

    await h.render().locate();
    await vi.advanceTimersByTimeAsync(90000);
    expect(h.render().phase).toBe('EXPIRED');
    await h.render().confirm();
    expect(mocks.combined).not.toHaveBeenCalled();
    expect(mocks.challenge).toHaveBeenCalledOnce();
  });
  it('ignores slow GPS returned after authorization expiry', async () => {
    const h = await combinedSetup();
    const gps = deferred<{ latitude: number; longitude: number; accuracy: number }>();

    mocks.location.mockReturnValue(gps.promise);
    const locating = h.render().locate();

    await vi.advanceTimersByTimeAsync(91000);
    gps.resolve({ latitude: -19, longitude: -65, accuracy: 1 });
    await locating;
    expect(h.render().phase).toBe('EXPIRED');
    await h.render().confirm();
    expect(mocks.combined).not.toHaveBeenCalled();
  });
  it.each(['LOW_ACCURACY', 'OUTSIDE_AREA', 'LOCATION_INVALID'])(
    'allows explicit recapture for %s without renewing challenge',
    async (code) => {
      const h = await combinedSetup();

      await h.render().locate();
      mocks.combined.mockRejectedValueOnce(failure(code, 422));
      await h.render().confirm();
      expect(h.render().phase).toBe('READY_FOR_LOCATION');
      await h.render().locate();
      await h.render().confirm();
      expect(h.render().phase).toBe('SUCCESS');
      expect(mocks.challenge).toHaveBeenCalledOnce();
    },
  );
  it.each(['COMBINED_AUTHORIZATION_EXPIRED', 'COMBINED_AUTHORIZATION_INVALID', 'NOT_ENROLLED'])(
    'stops on %s',
    async (code) => {
      const h = await combinedSetup();

      await h.render().locate();
      mocks.combined.mockRejectedValueOnce(failure(code));
      await h.render().confirm();
      await h.render().confirm();
      expect(mocks.combined).toHaveBeenCalledOnce();
      expect(['ERROR', 'EXPIRED']).toContain(h.render().phase);
    },
  );
  it('reconciles a lost response without another combined POST; null remains uncertain', async () => {
    const h = await combinedSetup();

    await h.render().locate();
    mocks.combined.mockRejectedValueOnce(new Error('lost response'));
    await h.render().confirm();
    expect(h.render().phase).toBe('UNCERTAIN');
    await h.render().confirm();
    expect(mocks.combined).toHaveBeenCalledOnce();
    mocks.own.mockResolvedValueOnce({ ownMark: { ...qrMark, registrationMethod: 'GEOLOCATION_QR' } });
    await h.render().readOwn();
    expect(h.render().phase).toBe('ALREADY_REGISTERED');
    expect(mocks.combined).toHaveBeenCalledOnce();
  });
  it('discards authorization and GPS on a change of account', async () => {
    const h = await combinedSetup();

    await h.render().locate();
    mocks.user = { ...student, idUser: 6 };
    h.render();
    await settle(h);
    await h.render().confirm();
    expect(h.render().context).toBeNull();
    expect(mocks.combined).not.toHaveBeenCalled();
    expect(mocks.challenge).toHaveBeenCalledOnce();
  });
  it('ignores a late challenge from a previous scan', async () => {
    mocks.context.mockResolvedValue({ ...qrContext(), mode: 'GEOLOCATION_QR' });
    const old = deferred<ReturnType<typeof combinedChallenge>>();

    mocks.challenge.mockReturnValueOnce(old.promise);
    const h = setup();

    await settle(h);
    mocks.context.mockResolvedValue(qrContext(8));
    browser.location.hash = '#t=' + qrToken(8);
    browser.dispatchEvent(new Event('hashchange'));
    await settle(h);
    old.resolve(combinedChallenge());
    await settle(h);
    expect(h.render().context?.idAttendanceSession).toBe(8);
    expect(h.render().phase).toBe('READY');
  });
});

it.each([1, 3, 0])('keeps GPS failure %s separate from an uncertain POST and allows explicit retry', async (code) => {
  const h = await combinedSetup();

  mocks.location.mockRejectedValueOnce(new BrowserLocationError(code));
  await h.render().locate();
  expect(h.render().phase).toBe('READY_FOR_LOCATION');
  expect(mocks.combined).not.toHaveBeenCalled();
  await h.render().locate();
  expect(h.render().phase).toBe('READY_TO_CONFIRM');
  expect(mocks.challenge).toHaveBeenCalledOnce();
});
it.each([
  { latitude: NaN, longitude: 0, accuracy: 1 },
  { latitude: 91, longitude: 0, accuracy: 1 },
  { latitude: 0, longitude: 181, accuracy: 1 },
  { latitude: 0, longitude: 0, accuracy: -1 },
  { latitude: 0, longitude: 0, accuracy: Infinity },
])('rejects invalid browser position without a POST: %j', async (point) => {
  const h = await combinedSetup();

  mocks.location.mockResolvedValueOnce(point);
  await h.render().locate();
  await h.render().confirm();
  expect(h.render().phase).toBe('READY_FOR_LOCATION');
  expect(mocks.combined).not.toHaveBeenCalled();
});
it('bounds authorization by endsAt and notices browser resume without trusting the device wall clock alone', async () => {
  mocks.context.mockResolvedValue({ ...qrContext(), mode: 'GEOLOCATION_QR' });
  mocks.challenge.mockResolvedValue({ ...combinedChallenge(), endsAt: new Date(Date.now() + 15000).toISOString() });
  const h = setup();

  await settle(h);
  expect(h.render().remaining).toBeLessThanOrEqual(15);
  vi.setSystemTime(Date.now() + 16000);
  browser.dispatchEvent(new Event('pageshow'));
  expect(h.render().phase).toBe('EXPIRED');
  expect(mocks.challenge).toHaveBeenCalledOnce();
});
it('ignores late GPS after a new scan and never leaks its position into historical QR', async () => {
  const h = await combinedSetup();
  const pending = deferred<{ latitude: number; longitude: number; accuracy: number }>();

  mocks.location.mockReturnValueOnce(pending.promise);
  const locating = h.render().locate();

  mocks.context.mockResolvedValue(qrContext(8));
  browser.location.hash = '#t=' + qrToken(8);
  browser.dispatchEvent(new Event('hashchange'));
  await settle(h);
  pending.resolve({ latitude: -19, longitude: -65, accuracy: 10 });
  await locating;
  expect(h.render().context?.idAttendanceSession).toBe(8);
  expect(h.render().phase).toBe('READY');
  expect(mocks.combined).not.toHaveBeenCalled();
});
it('does not obtain a challenge when a QR expires during the read-only discovery request', async () => {
  const pending = deferred<IQrContext>();

  mocks.context.mockReturnValueOnce(pending.promise);
  const h = setup();

  await settle(h);
  await vi.advanceTimersByTimeAsync(35000);
  pending.resolve({ ...qrContext(), mode: 'GEOLOCATION_QR' });
  await settle(h);
  expect(h.render().phase).toBe('EXPIRED');
  expect(mocks.challenge).not.toHaveBeenCalled();
});

it('does not extend authorization when the wall clock moves backwards', async () => {
  const monotonic = vi.spyOn(performance, 'now').mockReturnValue(0);

  try {
    const h = await combinedSetup();

    vi.setSystemTime(Date.now() - 60000);
    monotonic.mockReturnValue(91000);
    browser.dispatchEvent(new Event('pageshow'));
    expect(h.render().phase).toBe('EXPIRED');
    await h.render().confirm();
    expect(mocks.combined).not.toHaveBeenCalled();
  } finally {
    monotonic.mockRestore();
  }
});
it('respects rate limits without renewing the challenge or retrying POST', async () => {
  const h = await combinedSetup();

  await h.render().locate();
  mocks.combined.mockRejectedValueOnce(failure('RATE_LIMITED', 429, { 'retry-after': '2' }));
  await h.render().confirm();
  await h.render().locate();
  expect(mocks.location).toHaveBeenCalledOnce();
  expect(mocks.combined).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(2000);
  await h.render().locate();
  await h.render().confirm();
  expect(h.render().phase).toBe('SUCCESS');
  expect(mocks.challenge).toHaveBeenCalledOnce();
});
it('respects a 503 Retry-After before own-mark reconciliation, without resending', async () => {
  const h = await combinedSetup();

  await h.render().locate();
  mocks.combined.mockRejectedValueOnce(failure('UNAVAILABLE', 503, { 'retry-after': '2' }));
  await h.render().confirm();
  expect(h.render().phase).toBe('UNCERTAIN');
  await h.render().readOwn();
  expect(mocks.own).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2000);
  await h.render().readOwn();
  expect(mocks.own).toHaveBeenCalledOnce();
  expect(mocks.combined).toHaveBeenCalledOnce();
  expect(h.render().phase).toBe('UNCERTAIN');
});
