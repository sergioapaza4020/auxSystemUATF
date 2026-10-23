import axios from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';

import { clearTokens, getAccessToken } from '@/utils/authCookies';
import { refreshAccessToken } from '../auth.service';
import { AUTH_ROUTES } from './auth-routes';
import { SESSION_EXPIRED_EVENT } from '@/utils/authEvents';

type RetryRequest = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

function refreshOnce(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch((error: unknown) => {
        clearTokens();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        window.location.href = '/login';
        console.error('Refresh token failed');

        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

function isPublicAuthRequest(config: InternalAxiosRequestConfig): boolean {
  const path = new URL(config.url ?? '', 'http://axios.local').pathname.replace(/\/+$/, '');

  return [AUTH_ROUTES.login, AUTH_ROUTES.refresh, AUTH_ROUTES.checkRegistration].some(
    (route) => path === route || path === `/api${route}`,
  );
}

export const instance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  timeout: 10000,
  withCredentials: true,
  headers: { 'X-Custom-Header': 'foobar' },
});

instance.interceptors.request.use((config) => {
  const token = getAccessToken();

  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

instance.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest: RetryRequest | undefined = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isPublicAuthRequest(originalRequest)
    ) {
      originalRequest._retry = true;

      // A late 401 for an older token can reuse a refresh that already completed.
      const currentToken = getAccessToken();

      const newAccessToken =
        currentToken && originalRequest.headers.Authorization !== `Bearer ${currentToken}`
          ? currentToken
          : await refreshOnce();

      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return instance(originalRequest);
    }

    console.error('Response error:', error.response?.status ?? 'Request failed');

    return Promise.reject(error);
  },
);
