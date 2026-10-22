import type { ILogin, LoginResponse, RefreshResponse } from '@/interfaces/auth/auth.interface';

import { instance } from '@/api/config/config';

import { getRefreshToken, saveTokens, setAccessToken } from '@/utils/authCookies';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { refreshInstance } from './config/refreshInstance';
import { AUTH_ROUTES } from './config/auth-routes';

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
