import { AxiosError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkRegistration,
  getCurrentUser,
  hasPendingLogout,
  login,
  logoutAuthSession,
  refreshAccessToken,
} from './auth.service';
import { instance } from './config/config';
import { clearTokens, getAccessToken, getRefreshToken } from '@/utils/authCookies';
import { memorySessionStorage } from '@/test-utils/qr-fixtures';

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

const originalAdapter = instance.defaults.adapter;
const oldAccess = 'old-access-token';
const newAccess = 'new-access-token';

function reply(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { config, data, status, statusText: 'OK', headers: {} };
}

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    data: { status: false, statusCode: 401 },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
  });
}

beforeEach(() => {
  clearTokens();
  cookies.values.clear();
  vi.clearAllMocks();
  vi.stubGlobal(
    'window',
    Object.assign(new EventTarget(), {
      location: { origin: 'http://localhost:3000', href: '/dashboard' },
      localStorage: memorySessionStorage(),
    }),
  );
  vi.stubGlobal('navigator', { locks: undefined });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  instance.defaults.adapter = originalAdapter;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('same-origin HttpOnly authentication transport', () => {
  it.each([false, true])('sends rememberMe=%s through the login handler', async (rememberMe) => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => reply(config, { data: { accessToken: newAccess } }, 200));

    instance.defaults.adapter = adapter;

    await login({ username: 'test-user', password: 'secret', rememberMe });

    const request = adapter.mock.calls[0][0];

    expect(request.url).toBe('http://localhost:3000/api/auth/login');
    expect(JSON.parse(request.data as string)).toEqual({ username: 'test-user', password: 'secret', rememberMe });
    expect(request.headers['X-UATF-CSRF']).toBe('1');
    expect(getAccessToken()).toBe(newAccess);
    expect(getRefreshToken()).toBeUndefined();
  });

  it('refreshes with the browser-managed cookie and stores only the access token in memory', async () => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => reply(config, { data: { accessToken: newAccess } }));

    instance.defaults.adapter = adapter;

    await expect(refreshAccessToken()).resolves.toBe(newAccess);

    expect(adapter.mock.calls[0][0].url).toBe('http://localhost:3000/api/auth/refresh');
    expect(JSON.parse(adapter.mock.calls[0][0].data as string)).toEqual({});
    expect(getAccessToken()).toBe(newAccess);
    expect(cookies.set).not.toHaveBeenCalled();
  });

  it('uses Web Locks to serialize refresh requests across tabs', async () => {
    const lockRequest = vi.fn(async (_name: string, callback: () => Promise<unknown>) => callback());

    vi.stubGlobal('navigator', { locks: { request: lockRequest } });
    instance.defaults.adapter = async (config) => reply(config, { data: { accessToken: newAccess } });

    await refreshAccessToken();

    expect(lockRequest).toHaveBeenCalledOnce();
    expect(lockRequest.mock.calls[0][0]).toBe('uatf-auth-refresh');
  });

  it('refreshes one time after a protected request returns 401, then retries with the new Bearer token', async () => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => {
      if (config.url === 'http://localhost:3000/api/auth/refresh')
        return reply(config, { data: { accessToken: newAccess } });
      if (config.url === '/protected' && config.headers.Authorization === `Bearer ${oldAccess}`)
        throw unauthorized(config);

      return reply(config, { data: 'ok' });
    });

    instance.defaults.adapter = adapter;
    vi.stubGlobal('navigator', { locks: undefined });
    const { setAccessToken } = await import('@/utils/authCookies');

    setAccessToken(oldAccess);

    const result = await instance.get('/protected');

    expect(result.data.data).toBe('ok');
    expect(adapter).toHaveBeenCalledTimes(3);
    expect(adapter.mock.calls[1][0].url).toBe('http://localhost:3000/api/auth/refresh');
    expect(adapter.mock.calls[2][0].headers.Authorization).toBe(`Bearer ${newAccess}`);
  });

  it('does not recursively refresh a 401 returned by the refresh handler', async () => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => {
      throw unauthorized(config);
    });

    instance.defaults.adapter = adapter;
    vi.stubGlobal('navigator', { locks: undefined });

    await expect(refreshAccessToken()).rejects.toBeInstanceOf(AxiosError);
    expect(adapter).toHaveBeenCalledOnce();
    expect(adapter.mock.calls[0][0].url).toBe('http://localhost:3000/api/auth/refresh');
  });

  it('logs out through the local handler without sending a refresh token in JSON', async () => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => reply(config, { status: true, message: 'Sesión cerrada.' }));

    instance.defaults.adapter = adapter;
    const { setAccessToken } = await import('@/utils/authCookies');

    setAccessToken(oldAccess);

    await logoutAuthSession();

    expect(adapter.mock.calls[0][0].url).toBe('http://localhost:3000/api/auth/logout');
    expect(JSON.parse(adapter.mock.calls[0][0].data as string)).toEqual({});
    expect(getAccessToken()).toBeUndefined();
    expect(getRefreshToken()).toBeUndefined();
  });

  it.each(['ERR_NETWORK', 'ERR_BAD_RESPONSE'])(
    'preserves logout uncertainty for %s while clearing local access',
    async (code) => {
      const adapter = vi.fn<AxiosAdapter>(async (config) => {
        const response = code === 'ERR_BAD_RESPONSE' ? { ...reply(config, {}), status: 503 } : undefined;

        throw new AxiosError('Logout could not be confirmed', code, config, undefined, response);
      });

      instance.defaults.adapter = adapter;
      const { setAccessToken } = await import('@/utils/authCookies');

      setAccessToken(oldAccess);

      await expect(logoutAuthSession()).rejects.toMatchObject({ code });
      expect(getAccessToken()).toBeUndefined();
      expect(adapter).toHaveBeenCalledOnce();
      expect(hasPendingLogout()).toBe(true);
      await expect(getCurrentUser()).rejects.toThrow('pendiente');
      await expect(refreshAccessToken()).rejects.toThrow('pendiente');
      await expect(login({ username: 'fixture', password: 'fixture', rememberMe: false })).rejects.toThrow(
        'Servicio de autenticación',
      );
      expect(adapter).toHaveBeenCalledTimes(2);
      expect(hasPendingLogout()).toBe(true);
      expect(adapter.mock.calls[1][0].url).toContain('/api/auth/logout');
      expect(adapter.mock.calls[1][0].timeout).toBe(10000);

      adapter.mockImplementationOnce(async (config) => reply(config, { status: true }));
      await logoutAuthSession();
      expect(hasPendingLogout()).toBe(false);
      expect(adapter).toHaveBeenCalledTimes(3);
    },
  );

  it('confirms pending logout before sending new credentials, without exposing recovery secrets', async () => {
    window.localStorage.setItem('uatf.auth.logout-pending', '1');

    const adapter = vi.fn<AxiosAdapter>(async (config) =>
      reply(config, config.url?.endsWith('/logout') ? { status: true } : { data: { accessToken: newAccess } }),
    );

    instance.defaults.adapter = adapter;
    await login({ username: 'fixture', password: 'fixture', rememberMe: true });

    expect(adapter).toHaveBeenCalledTimes(2);
    expect(adapter.mock.calls[0][0].url).toContain('/api/auth/logout');
    expect(JSON.parse(adapter.mock.calls[0][0].data as string)).toEqual({});
    expect(adapter.mock.calls[1][0].url).toContain('/api/auth/login');
    expect(hasPendingLogout()).toBe(false);
    expect(getAccessToken()).toBe(newAccess);
    expect(getRefreshToken()).toBeUndefined();
  });

  it('keeps the public registration and profile response contracts', async () => {
    const user = { idUser: 1, username: 'test-user', roles: ['STUDENT'], permissions: [] };

    instance.defaults.adapter = async (config) => {
      if (config.url === '/auth/check-registration')
        return reply(config, { data: { registered: true, status: 'ACTIVE' } });

      return reply(config, { data: user });
    };

    await expect(checkRegistration(' 123 ')).resolves.toEqual({ registered: true, status: 'ACTIVE' });
    await expect(getCurrentUser()).resolves.toEqual(user);
  });
});
