import { AxiosError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCurrentUser, login, refreshAccessToken } from './auth.service';
import { instance } from './config/config';
import { refreshInstance } from './config/refreshInstance';
import { logout, revokeSessionById } from './sessions.service';
import { getAccessToken, getRefreshToken } from '@/utils/authCookies';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';

const cookies = vi.hoisted(() => {
  const values = new Map<string, string>();

  return {
    values,
    get: vi.fn((name: string) => values.get(name)),
    set: vi.fn((name: string, value: string) => values.set(name, value)),
    remove: vi.fn((name: string) => values.delete(name)),
  };
});

vi.mock('js-cookie', () => ({ default: cookies }));

const mainAdapter = instance.defaults.adapter;
const tokenAdapter = refreshInstance.defaults.adapter;
const oldAccess = 'expired-access';
const newAccess = 'renewed-access';

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    data: { status: false, statusCode: 401 },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  });
}

function reply(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { config, data, status, statusText: 'OK', headers: {} };
}

beforeEach(() => {
  cookies.values.clear();
  cookies.values.set('accessToken', oldAccess);
  cookies.values.set('refreshToken', 'existing-refresh');
  vi.clearAllMocks();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { href: '/dashboard' } }));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  instance.defaults.adapter = mainAdapter;
  refreshInstance.defaults.adapter = tokenAdapter;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Real auth service, cookie helpers and Axios interceptors', () => {
  it('uses the existing PATCH revocation endpoint and unwraps its envelope', async () => {
    const session = { idSession: 7, isActive: false };
    const adapter = vi.fn<AxiosAdapter>(async (config) => reply(config, { data: session }));

    instance.defaults.adapter = adapter;
    expect(await revokeSessionById(7)).toEqual(session);
    expect(adapter.mock.calls[0][0].url).toBe('/sessions/revoke/7');
    expect(adapter.mock.calls[0][0].method).toBe('patch');
  });
  it('renews once for 3 simultaneous expired requests, stores access and retries all with the new Bearer', async () => {
    let release!: () => void;

    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const renewal = vi.fn<AxiosAdapter>(async (config) => {
      await gate;

      return reply(config, { status: true, statusCode: 201, data: { accessToken: newAccess } }, 201);
    });

    const headers: string[] = [];

    refreshInstance.defaults.adapter = renewal;

    instance.defaults.adapter = async (config) => {
      const authorization = String(config.headers.Authorization);

      headers.push(authorization);
      if (authorization === `Bearer ${oldAccess}`) throw unauthorized(config);

      return reply(config, { data: 'success' });
    };

    const pending = Promise.all(['/a', '/b', '/c'].map((url) => instance.get(url)));

    await vi.waitFor(() => expect(renewal).toHaveBeenCalledTimes(1));
    expect(headers).toEqual(Array(3).fill(`Bearer ${oldAccess}`));
    release();
    const responses = await pending;

    expect(responses.every((response) => response.data.data === 'success')).toBe(true);
    expect(oldAccess).not.toBe(newAccess);
    expect(getAccessToken()).toBe(newAccess);
    expect(getRefreshToken()).toBe('existing-refresh');
    expect(cookies.set).toHaveBeenCalledTimes(1);
    expect(cookies.remove).not.toHaveBeenCalled();
    expect(headers.slice(3)).toEqual(Array(3).fill(`Bearer ${newAccess}`));
    expect(renewal).toHaveBeenCalledTimes(1);
    expect(JSON.parse(renewal.mock.calls[0][0].data as string)).toEqual({ refreshToken: 'existing-refresh' });
  });

  it('shares a failed refresh, clears tokens once and rejects all pending requests without looping', async () => {
    const expired = vi.fn();

    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    let release!: () => void;

    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const renewal = vi.fn<AxiosAdapter>(async (config) => {
      await gate;
      throw unauthorized(config);
    });

    refreshInstance.defaults.adapter = renewal;

    instance.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    const pending = Promise.allSettled(['/a', '/b', '/c'].map((url) => instance.get(url)));

    await vi.waitFor(() => expect(renewal).toHaveBeenCalledTimes(1));
    release();
    expect((await pending).every((result) => result.status === 'rejected')).toBe(true);
    expect(renewal).toHaveBeenCalledTimes(1);
    expect(cookies.remove.mock.calls).toEqual([['accessToken'], ['refreshToken']]);
    expect(window.location.href).toBe('/login');
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it.each([
    '/auth/login',
    '/auth/login?next=dashboard',
    'https://api.example/api/auth/login/',
    '/auth/refresh-access-token',
  ])('does not renew a 401 from public auth URL %s', async (url) => {
    const renewal = vi.fn<AxiosAdapter>();

    refreshInstance.defaults.adapter = renewal;

    instance.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };

    await expect(instance.post(url)).rejects.toBeInstanceOf(AxiosError);
    expect(renewal).not.toHaveBeenCalled();
    expect(cookies.remove).not.toHaveBeenCalled();
  });

  it('reuses a completed refresh for a late 401 with the old token', async () => {
    let releaseLate!: () => void;

    const late = new Promise<void>((resolve) => {
      releaseLate = resolve;
    });

    const renewal = vi.fn<AxiosAdapter>(async (config) => reply(config, { data: { accessToken: newAccess } }, 201));

    refreshInstance.defaults.adapter = renewal;

    instance.defaults.adapter = async (config) => {
      if (config.headers.Authorization === `Bearer ${oldAccess}`) {
        if (config.url === '/late') await late;
        throw unauthorized(config);
      }

      return reply(config, 'ok');
    };

    const delayed = instance.get('/late');

    await instance.get('/first');
    releaseLate();
    await delayed;
    expect(renewal).toHaveBeenCalledTimes(1);
  });

  it('stops after a retried request returns another 401', async () => {
    const renewal = vi.fn<AxiosAdapter>(async (config) => reply(config, { data: { accessToken: newAccess } }, 201));

    const main = vi.fn<AxiosAdapter>(async (config) => {
      throw unauthorized(config);
    });

    refreshInstance.defaults.adapter = renewal;
    instance.defaults.adapter = main;
    await expect(instance.get('/protected')).rejects.toBeInstanceOf(AxiosError);
    expect(renewal).toHaveBeenCalledTimes(1);
    expect(main).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed refresh responses without storing undefined', async () => {
    refreshInstance.defaults.adapter = async (config) => reply(config, { data: {} }, 201);
    await expect(refreshAccessToken()).rejects.toThrow('Invalid refresh response');
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it('does not send refresh without a refresh cookie', async () => {
    cookies.values.delete('refreshToken');
    const renewal = vi.fn<AxiosAdapter>();

    refreshInstance.defaults.adapter = renewal;
    await expect(refreshAccessToken()).rejects.toThrow('Refresh token not found');
    expect(renewal).not.toHaveBeenCalled();
  });

  it('keeps login, auth/me permissions and logout contracts intact', async () => {
    const user = { idUser: 1, roles: ['SUPERADMIN'], permissions: ['session.get-all'] };

    instance.defaults.adapter = async (config) => {
      if (config.url === '/auth/login')
        return reply(config, { data: { accessToken: newAccess, refreshToken: 'login-refresh' } }, 201);
      if (config.url === '/auth/me') return reply(config, { data: user });

      return reply(config, { data: null });
    };

    await login({ username: 'test', password: 'test-password' });
    expect(getAccessToken()).toBe(newAccess);
    expect(getRefreshToken()).toBe('login-refresh');
    expect(await getCurrentUser()).toEqual(user);
    await logout();
    expect(getAccessToken()).toBeUndefined();
    expect(getRefreshToken()).toBeUndefined();
  });
});
