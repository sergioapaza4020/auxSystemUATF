import { NextRequest } from 'next/server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as login } from '@/app/api/auth/login/route';
import { POST as refresh } from '@/app/api/auth/refresh/route';
import { POST as logout } from '@/app/api/auth/logout/route';
import { GET as authStatus } from '@/app/api/auth/status/route';

vi.mock('server-only', () => ({}));

const transportKey = 'a'.repeat(64);

const credentials = {
  accessToken: 'access-secret',
  refreshToken: 'refresh-secret',
  sessionExpiresAt: new Date(Math.floor(Date.now() / 1000) * 1000 + 12 * 3600000).toISOString(),
  rememberMe: false as boolean | null,
};

function request(operation: 'login' | 'refresh' | 'logout', options: { body?: object; refresh?: string } = {}) {
  const headers = new Headers({
    origin: 'http://localhost:3000',
    host: 'localhost:3000',
    'x-uatf-csrf': '1',
    'content-type': 'application/json',
  });

  const req = new NextRequest(`http://localhost:3000/api/auth/${operation}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(options.body ?? {}),
  });

  if (options.refresh) req.cookies.set('uatf_refresh', options.refresh);

  return req;
}

function backendResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  vi.stubEnv('AUTH_PUBLIC_ORIGIN', 'http://localhost:3000');
  vi.stubEnv('AUTH_API_ORIGIN', 'http://localhost:3001');
  vi.stubEnv('AUTH_TRANSPORT_KEY', transportKey);
  vi.stubEnv('NODE_ENV', 'test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Next.js authentication Route Handler', () => {
  it('reports HttpOnly cookie presence to the restored QR flow without exposing credentials', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/status');

    req.cookies.set('uatf_refresh', 'refresh-secret');

    const response = authStatus(req);

    expect(await response.json()).toEqual({ hasSession: true });
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('creates a 12-hour session through Nest and returns no refresh token to JavaScript', async () => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ data: credentials }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await login(
      request('login', { body: { username: 'user', password: 'secret', rememberMe: false } }),
    );

    const body = await response.json();
    const cookie = (response.headers.get('set-cookie') ?? '').split(', uatf_logout_pending=')[0];

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3001/api/auth/session/login');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json',
      'x-uatf-auth-transport': transportKey,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      username: 'user',
      password: 'secret',
      rememberMe: false,
    });
    expect(body.data).toEqual({ accessToken: 'access-secret' });
    expect(JSON.stringify(body)).not.toContain('refresh-secret');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('refresh-secret');
    expect(cookie).not.toMatch(/Max-Age=|Expires=/i);
  });

  it('sets a persistent HttpOnly cookie to the absolute expiry for rememberMe=true', async () => {
    const expiresAt = new Date(Math.floor(Date.now() / 1000) * 1000 + 30 * 24 * 3600000);

    const fetchMock = vi.fn().mockResolvedValue(
      backendResponse({
        data: { ...credentials, rememberMe: true, sessionExpiresAt: expiresAt.toISOString() },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await login(
      request('login', { body: { username: 'user', password: 'secret', rememberMe: true } }),
    );

    const cookie = response.headers.get('set-cookie') ?? '';

    expect(cookie).toContain('HttpOnly');
    const expires = cookie.match(/Expires=([^;]+)/)?.[1];

    expect(expires).toBeDefined();
    expect(Date.parse(expires!)).toBeLessThanOrEqual(expiresAt.getTime());
    expect(Date.parse(expires!)).toBeGreaterThanOrEqual(expiresAt.getTime() - 1000);
    expect(cookie).toContain('Max-Age=');
    expect(JSON.stringify(await response.json())).not.toContain('refresh-secret');
  });

  it('rotates refresh only from the HttpOnly request cookie and filters the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      backendResponse({
        data: { ...credentials, refreshToken: 'rotated-refresh' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await refresh(request('refresh', { refresh: 'current-refresh' }));

    expect(fetchMock.mock.calls[0][1].headers['x-uatf-auth-transport']).toBe(transportKey);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'current-refresh' });
    expect(JSON.stringify(await response.json())).not.toContain('rotated-refresh');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });

  it('rejects refresh without a cookie without calling Nest', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);

    const response = await refresh(request('refresh'));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes through Nest at logout and clears the refresh cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ message: 'Session revoked' }));

    vi.stubGlobal('fetch', fetchMock);

    const response = await logout(request('logout', { refresh: 'current-refresh' }));

    expect(fetchMock.mock.calls[0][1].headers['x-uatf-auth-transport']).toBe(transportKey);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'current-refresh' });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(JSON.stringify(await response.json())).not.toContain('current-refresh');
  });

  it('blocks invalid CSRF headers before forwarding credentials', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    const req = request('login', { body: { username: 'user', password: 'secret' } });

    req.headers.set('x-uatf-csrf', 'invalid');

    const response = await login(req);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 503 when Nest cannot complete logout and retains only an HttpOnly retry proof', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network unavailable'));

    vi.stubGlobal('fetch', fetchMock);

    const response = await logout(request('logout', { refresh: 'current-refresh' }));
    const cookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(503);
    expect(cookie).toContain('uatf_logout_pending=current-refresh');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Max-Age=0');
    expect(JSON.stringify(await response.json())).not.toContain('current-refresh');
  });

  it('preserves the logout proof when Nest rejects the transport key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(backendResponse({}, 403)));
    const response = await logout(request('logout', { refresh: 'current-refresh' }));

    expect(response.status).toBe(503);
    expect(response.cookies.get('uatf_logout_pending')).toMatchObject({
      httpOnly: true,
      value: 'current-refresh',
    });
    expect(response.cookies.get('uatf_refresh')?.maxAge).toBe(0);
  });

  it.each([200, 401])('retries the HttpOnly proof before login after revocation status %s', async (status) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(backendResponse({}, status))
      .mockResolvedValueOnce(backendResponse({ data: credentials }));

    vi.stubGlobal('fetch', fetchMock);
    const req = request('login', { body: { username: 'user', password: 'secret', rememberMe: true } });

    req.cookies.set('uatf_logout_pending', 'pending-secret');
    const response = await login(req);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/logout');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'pending-secret' });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[1][0]).toContain('/login');
    expect(response.cookies.get('uatf_logout_pending')?.maxAge).toBe(0);
    expect(JSON.stringify(await response.json())).not.toMatch(/pending-secret|refresh-secret/);
  });

  it('retains unconfirmed recovery without logging in or returning a logout notice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({}, 503));

    vi.stubGlobal('fetch', fetchMock);
    const req = request('login', { body: { username: 'user', password: 'secret' } });

    req.cookies.set('uatf_logout_pending', 'pending-secret');
    const response = await login(req);
    const body = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(body).not.toMatch(/pending-secret|cierre|Reintentar/);
    expect(body).toContain('Servicio de autenticación');
  });

  it('rejects an untrusted origin before sending any upstream request', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    const req = request('login', { body: { username: 'user', password: 'secret' } });

    req.headers.set('origin', 'https://other.test');
    expect((await login(req)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the transport key is missing', async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('AUTH_TRANSPORT_KEY', '');
    expect((await login(request('login'))).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 401],
    [403, 503],
  ])('maps Nest status %s to %s without a cookie', async (upstream, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(backendResponse({ message: 'Internal detail' }, upstream)));
    const response = await login(request('login', { body: { username: 'user', password: 'wrong' } }));

    expect(response.status).toBe(status);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(JSON.stringify(await response.json())).not.toContain('Internal detail');
  });

  it('migrates a historical cookie and sets Secure on HTTPS', async () => {
    vi.stubEnv('AUTH_PUBLIC_ORIGIN', 'https://frontend.test');
    const fetchMock = vi.fn().mockResolvedValue(backendResponse({ data: { ...credentials, rememberMe: null } }));

    vi.stubGlobal('fetch', fetchMock);
    const req = request('refresh');

    req.headers.set('host', 'frontend.test');
    req.headers.set('origin', 'https://frontend.test');
    req.cookies.set('refreshToken', 'historical');

    const response = await refresh(req);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'historical' });
    expect(response.cookies.get('uatf_refresh')).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      value: 'refresh-secret',
    });
    expect(response.cookies.get('refreshToken')?.maxAge).toBe(0);
  });
});
