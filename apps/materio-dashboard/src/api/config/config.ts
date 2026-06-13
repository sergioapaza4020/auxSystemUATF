import axios from 'axios';

import { clearTokens, getAccessToken } from '@/utils/authCookies';
import { refreshAccessToken } from '../auth.service';

export const instance = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  timeout: 5000,
  withCredentials: true,
  headers: { 'X-Custom-Header': 'foobar' },
});

instance.interceptors.request.use((config: any) => {
  const token = getAccessToken();

  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

instance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newAccessToken = await refreshAccessToken();

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        return instance(originalRequest);
      } catch (error) {
        clearTokens();
        window.location.href = '/login';
        console.error(`Refresh token failed: ${error}`);

        return Promise.reject(error);
      }
    }

    console.error('Response error:', error);

    return Promise.reject(error);
  },
);
