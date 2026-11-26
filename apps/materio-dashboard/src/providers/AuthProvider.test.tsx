import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { savePendingQr, QR_PENDING_KEY } from '@/utils/student-qr-flow';
import { memorySessionStorage, qrToken } from '@/test-utils/qr-fixtures';

import { getCurrentUser } from '@/api/auth.service';
import { logout } from '@/api/sessions.service';
import { deferred, hookHarness } from '@/test-utils/hook-harness';
import { AuthProvider } from './AuthProvider';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { clearTokens } from '@/utils/authCookies';

const mocks = vi.hoisted(() => ({ pathname: '/dashboard', snackbar: { error: vi.fn(), open: false } }));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks.snackbar }));
vi.mock('@/api/auth.service', () => ({ getCurrentUser: vi.fn() }));
vi.mock('@/api/sessions.service', () => ({ logout: vi.fn() }));
vi.mock('@/utils/authCookies', () => ({ clearTokens: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('window', new EventTarget());
  mocks.pathname = '/dashboard';
  mocks.snackbar = { error: vi.fn(), open: false };
});
afterEach(() => vi.unstubAllGlobals());

describe('AuthProvider lifecycle', () => {
  it('warns when logout is unconfirmed and still clears the local identity', async () => {
    vi.mocked(logout).mockRejectedValueOnce(new Error('Network unavailable'));
    const h = hookHarness(() => AuthProvider({ children: null }));

    h.render();
    await Promise.resolve();
    await h.render().props.value.logout();

    expect(mocks.snackbar.error).toHaveBeenCalledWith(expect.stringContaining('No se pudo confirmar el cierre'));
    expect(h.render().props.value.user).toBeNull();
    expect(clearTokens).toHaveBeenCalled();
    h.unmount();
  });

  it('discards the previous identity before loading the account selected in another tab', async () => {
    const receiver: { onmessage?: (event: MessageEvent<unknown>) => void } = {};

    vi.stubGlobal(
      'BroadcastChannel',
      class {
        set onmessage(handler: (event: MessageEvent<unknown>) => void) {
          receiver.onmessage = handler;
        }

        close() {}
      },
    );

    const oldUser: ICurrentUser = {
      idUser: 5,
      idSession: 7,
      name: 'Ana',
      username: 'ana',
      email: '',
      roles: ['STUDENT'],
      permissions: [],
    };

    const newUser = { ...oldUser, idUser: 6, idSession: 8, name: 'Luis', username: 'luis' };
    const stale = deferred<ICurrentUser>();
    const fresh = deferred<ICurrentUser>();

    vi.mocked(getCurrentUser)
      .mockResolvedValueOnce(oldUser)
      .mockReturnValueOnce(stale.promise)
      .mockImplementation(() => (vi.mocked(clearTokens).mock.calls.length ? fresh.promise : Promise.resolve(oldUser)));
    const h = hookHarness(() => AuthProvider({ children: null }));

    h.render();
    await Promise.resolve();
    expect(h.render().props.value.user).toEqual(oldUser);
    const oldRequest = h.render().props.value.refreshUser();

    receiver.onmessage?.(new MessageEvent('message', { data: { type: 'login' } }));
    expect(clearTokens).toHaveBeenCalledTimes(1);
    expect(h.render().props.value.user).toBeNull();
    expect(h.render().props.value.loading).toBe(true);
    fresh.resolve(newUser);
    await Promise.resolve();
    expect(h.render().props.value.user).toEqual(newUser);
    stale.resolve(oldUser);
    await oldRequest;
    expect(h.render().props.value.user).toEqual(newUser);
    h.unmount();
  });
  it('clears authenticated state on definitive refresh failure and ignores an old profile response', async () => {
    const user: ICurrentUser = {
      idUser: 5,
      idSession: 7,
      name: 'Ana',
      username: 'ana',
      email: '',
      roles: ['STUDENT'],
      permissions: [],
    };

    const pending = deferred<ICurrentUser>();

    vi.mocked(getCurrentUser).mockResolvedValueOnce(user).mockReturnValueOnce(pending.promise);
    const h = hookHarness(() => AuthProvider({ children: null }));

    h.render();
    await Promise.resolve();
    expect(h.render().props.value.user).toEqual(user);
    const refresh = h.render().props.value.refreshUser();

    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    expect(h.render().props.value.user).toBeNull();
    expect(h.render().props.value.loading).toBe(false);
    pending.resolve(user);
    await refresh;
    expect(h.render().props.value.user).toBeNull();
    h.unmount();
  });
  it.each([false, true])('does not reload auth when notifications change (failure=%s)', async (failure) => {
    const user = {
      idUser: 5,
      idSession: 1,
      name: 'Ana',
      username: 'ana',
      email: '',
      roles: ['STUDENT'],
      permissions: [],
    };

    if (failure) vi.mocked(getCurrentUser).mockRejectedValue(new Error('auth failed'));
    else vi.mocked(getCurrentUser).mockResolvedValue(user);
    const h = hookHarness(() => AuthProvider({ children: null }));

    expect(h.render().props.value.loading).toBe(true);
    await Promise.resolve();
    expect(h.render().props.value.loading).toBe(false);
    expect(h.render().props.value.user).toEqual(failure ? null : user);

    for (const open of [true, false, true]) {
      mocks.snackbar = { ...mocks.snackbar, open };
      h.render();
    }

    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    expect(mocks.snackbar.error).toHaveBeenCalledTimes(failure ? 1 : 0);
    h.unmount();
  });
  it('skips public routes and loads when entering the dashboard', async () => {
    mocks.pathname = '/login';
    const h = hookHarness(() => AuthProvider({ children: null }));

    h.render();
    expect(getCurrentUser).not.toHaveBeenCalled();
    mocks.pathname = '/dashboard';
    h.render();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    h.unmount();
  });
});

describe('QR authentication integration', () => {
  it('does not query academic or auth endpoints merely by opening public QR', () => {
    mocks.pathname = '/attendance/qr';
    const h = hookHarness(() => AuthProvider({ children: null }));

    h.render();
    expect(getCurrentUser).not.toHaveBeenCalled();
    h.unmount();
  });
  it('clears QR login transfer on ordinary logout', async () => {
    vi.stubGlobal('window', Object.assign(new EventTarget(), { sessionStorage: memorySessionStorage() }));
    const h = hookHarness(() => AuthProvider({ children: null }));

    h.render();
    savePendingQr(qrToken());
    await h.render().props.value.logout();
    expect(window.sessionStorage.getItem(QR_PENDING_KEY)).toBeNull();
    h.unmount();
  });
});
