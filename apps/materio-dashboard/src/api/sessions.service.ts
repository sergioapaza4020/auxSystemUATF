import { clearTokens, getRefreshToken } from '@/utils/authCookies';
import { instance } from './config/config';

export const logout = async (): Promise<void> => {
  const refreshToken = getRefreshToken();

  if (refreshToken) await instance.post('/sessions/logout', { refreshToken });

  clearTokens();
};

export const getAllSessions = async (): Promise<any> => {
  const sessions = await instance.get('/sessions');

  return sessions.data.data;
};

export const revokeSessionById = async (idSession: number): Promise<any> => {
  const response = await instance.patch(`/sessions/revoke/${idSession}`);

  return response.data.data;
};
