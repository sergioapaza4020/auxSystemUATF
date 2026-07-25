import type { ILogin } from '@/interfaces/auth/auth.interface';

import { instance } from '@/api/config/config';

import { getRefreshToken, saveTokens, setAccessToken } from '@/utils/authCookies';
import type { ApiResponse } from '@/interfaces/apiResponse';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { refreshInstance } from './config/refreshInstance';

export const Login = async ({ username, password }: ILogin): Promise<any> => {
  try {
    const response = await instance.post('/auth/login', { username, password });

    const { accessToken, refreshToken } = response.data.data;

    saveTokens(accessToken, refreshToken);
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const getCurrentUser = async (): Promise<any> => {
  try {
    const response = await instance.get<ApiResponse<ICurrentUser>>('/auth/me');

    return response.data.data;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const refreshAccessToken = async (): Promise<any> => {
  try {
    const refreshToken = getRefreshToken();

    if (!refreshToken) throw new Error('Refresh token not found');

    const response = await refreshInstance.post('/auth/refresh-access-token', { refreshToken });

    setAccessToken(response.data.data.accessToken);

    return response.data.data.accessToken;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};
