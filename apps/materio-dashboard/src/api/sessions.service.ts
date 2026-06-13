import { clearTokens, getRefreshToken } from '@/utils/authCookies';
import { instance } from './config/config';

export const Logout = async (): Promise<void> => {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await instance.post('/sessions/logout', { refreshToken });
    } catch (error: any) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  clearTokens();
};

export const getAllSessions = async (): Promise<any> => {
  try {
    const sessions = await instance.get('/sessions');

    return sessions.data.data;
  } catch (error) {
    console.error(error);
  }
};

export const getMySessions = async (): Promise<any> => {
  try {
    const sessions = await instance.get('/sessions/my-sessions');

    return sessions.data.data;
  } catch (error: any) {
    console.error(error);
  }
};

export const revokeSessionById = async (idSession: number) => {
  try {
    const response = await instance.patch(`/sessions/revoke/${idSession}`);

    return response.data;
  } catch (error: any) {
    console.error(error);

    throw error;
  }
};
