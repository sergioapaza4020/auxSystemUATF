import type { ILogin, LoginResponse, RefreshResponse } from '@/interfaces/auth/auth.interface';

import { instance } from '@/api/config/config';

import { clearTokens, setAccessToken } from '@/utils/authCookies';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import type { RegistrationCheck } from '@/interfaces/auth/registration-check.interface';
import { AUTH_ROUTES } from './config/auth-routes';

const localAuthConfig = {
  withCredentials: true,
  headers: { 'X-UATF-CSRF': '1' },
};

const pendingLogoutKey = 'uatf.auth.logout-pending';

export function hasPendingLogout(): boolean {
  try {
    return window.localStorage.getItem(pendingLogoutKey) === '1';
  } catch {
    return false;
  }
}

function recordPendingLogout(pending: boolean) {
  try {
    if (pending) window.localStorage.setItem(pendingLogoutKey, '1');
    else window.localStorage.removeItem(pendingLogoutKey);
  } catch {
    // Browsers may block storage. The current caller still receives the logout result.
  }
}

function announceAuthChange(type: 'login' | 'logout') {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel('uatf-auth');

  channel.postMessage({ type });
  channel.close();
}

function localAuthPath(path: string): string {
  if (typeof window === 'undefined') throw new Error('Authentication transport requires a browser origin');

  return new URL(path, window.location.origin).toString();
}

export const checkRegistration = async (ru: string): Promise<RegistrationCheck> => {
  const response = await instance.post<ApiResponse<RegistrationCheck>>(AUTH_ROUTES.checkRegistration, {
    ru: ru.trim(),
  });

  const data = response.data.data;

  if (data?.registered === true && (data.status === 'ACTIVE' || data.status === 'INACTIVE')) {
    return { registered: true, status: data.status };
  }

  if (data?.registered === false && data.status === 'NOT_FOUND') {
    return { registered: false, status: 'NOT_FOUND' };
  }

  throw new Error('Invalid registration response');
};

export const login = async ({ username, password, rememberMe }: ILogin): Promise<void> => {
  if (hasPendingLogout()) {
    // Retry once before sending credentials; keep uncertain sessions blocked on failure.
    try {
      await logoutAuthSession();
    } catch {
      throw new Error('Servicio de autenticación temporalmente no disponible. Reintenta.');
    }
  }

  const response = await instance.post<ApiResponse<LoginResponse>>(
    localAuthPath('/api/auth/login'),
    { username, password, rememberMe },
    localAuthConfig,
  );

  const accessToken = response.data.data?.accessToken;

  if (typeof accessToken !== 'string' || !accessToken) throw new Error('Invalid login response');
  setAccessToken(accessToken);
  announceAuthChange('login');
};

export const getCurrentUser = async (): Promise<ICurrentUser> => {
  if (hasPendingLogout()) throw new Error('Cierre de sesión pendiente.');

  const response = await instance.get<ApiResponse<ICurrentUser>>(AUTH_ROUTES.me);

  return response.data.data;
};

/** Detect only whether a server-managed refresh cookie exists; never expose it. */
export const hasAuthSessionCookie = async (): Promise<boolean> => {
  try {
    const response = await fetch('/api/auth/status', { cache: 'no-store', credentials: 'same-origin' });

    if (!response.ok) return false;
    const result: unknown = await response.json();

    return !!result && typeof result === 'object' && 'hasSession' in result && result.hasSession === true;
  } catch {
    return false;
  }
};

export const refreshAccessToken = async (): Promise<string> => {
  const renew = async () => {
    if (hasPendingLogout()) throw new Error('Cierre de sesión pendiente.');

    return instance.post<ApiResponse<RefreshResponse>>(localAuthPath('/api/auth/refresh'), {}, localAuthConfig);
  };

  let response;

  // The refresh cookie is shared across tabs. Web Locks serialize the browser
  // side so each tab reads the winner's newly rotated cookie before renewing.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    response = await navigator.locks.request('uatf-auth-refresh', renew);
  } else {
    response = await renew();
  }

  const accessToken = response.data.data?.accessToken;

  if (typeof accessToken !== 'string' || !accessToken) throw new Error('Invalid refresh response');

  setAccessToken(accessToken);

  return accessToken;
};

export const logoutAuthSession = async (): Promise<void> => {
  recordPendingLogout(true);

  try {
    await instance.post(localAuthPath('/api/auth/logout'), {}, localAuthConfig);
    recordPendingLogout(false);
  } finally {
    clearTokens();
    announceAuthChange('logout');
  }
};
