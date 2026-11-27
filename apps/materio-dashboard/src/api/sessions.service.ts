import { instance } from './config/config';
import { logoutAuthSession } from './auth.service';
import type { ApiResponse, PaginatedApiResponse } from '@/interfaces/apiResponse';
import type { ISession } from '@/interfaces/sessions/session.interface';

export interface SessionPageQuery {
  page: number;
  limit: number;
}

export const logout = async (): Promise<void> => {
  await logoutAuthSession();
};

export const getAllSessions = async (
  query: SessionPageQuery,
  signal?: AbortSignal,
): Promise<PaginatedApiResponse<ISession[]>> => {
  const sessions = await instance.get<PaginatedApiResponse<ISession[]>>('/sessions', { params: query, signal });

  return sessions.data;
};

export const revokeSessionById = async (idSession: number): Promise<ISession> => {
  const response = await instance.patch<ApiResponse<ISession>>(`/sessions/revoke/${idSession}`);

  return response.data.data;
};
