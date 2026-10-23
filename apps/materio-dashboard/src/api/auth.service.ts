import type { ILogin, LoginResponse, RefreshResponse } from '@/interfaces/auth/auth.interface';

import { instance } from '@/api/config/config';

import { getRefreshToken, saveTokens, setAccessToken } from '@/utils/authCookies';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import type { RegistrationCheck } from '@/interfaces/auth/registration-check.interface';
import { refreshInstance } from './config/refreshInstance';
import { AUTH_ROUTES } from './config/auth-routes';

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

export const login = async ({ username, password }: ILogin): Promise<void> => {
  const response = await instance.post<ApiResponse<LoginResponse>>(AUTH_ROUTES.login, { username, password });

  const { accessToken, refreshToken } = response.data.data;

  saveTokens(accessToken, refreshToken);
};

export const getCurrentUser = async (): Promise<ICurrentUser> => {
  const response = await instance.get<ApiResponse<ICurrentUser>>(AUTH_ROUTES.me);

  return response.data.data;
};

export const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) throw new Error('Refresh token not found');

  const response = await refreshInstance.post<ApiResponse<RefreshResponse>>(AUTH_ROUTES.refresh, { refreshToken });
  const accessToken = response.data.data?.accessToken;

  if (typeof accessToken !== 'string' || !accessToken) throw new Error('Invalid refresh response');

  setAccessToken(accessToken);

  return accessToken;
};
