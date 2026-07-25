import { clearTokens, getRefreshToken } from '@/utils/authCookies';
import { instance } from './config/config';

export const Logout = async (): Promise<void> => {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await instance.post('/sessions/logout', { refreshToken });
    } catch (error: any) {
      console.error(error.response.data);
      throw error;
    }
  }

  clearTokens();
};

export const getAllSessions = async (): Promise<any> => {
  try {
    const sessions = await instance.get('/sessions');

    return sessions.data.data;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};

export const revokeSessionById = async (idSession: number): Promise<any> => {
  try {
    const response = await instance.patch(`/sessions/revoke/${idSession}`);

    return response.data.data;
  } catch (error: any) {
    console.error(error.response.data);
    throw error;
  }
};
