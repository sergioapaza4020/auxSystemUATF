import type {
  OwnSession,
  PasswordChange,
  ProfileFields,
  PendingEmailChange,
} from '@/interfaces/auth/account-settings.interface';
import type { ApiResponse, PaginatedApiResponse } from '@/interfaces/apiResponse';

import { instance } from './config/config';

export async function updateOwnProfile(
  expectedSession: number,
  fields: Partial<Omit<ProfileFields, 'email'>>,
  signal: AbortSignal,
) {
  const response = await instance.patch<ApiResponse<ProfileFields>>('/auth/me', fields, {
    params: { expectedSession },
    signal,
  });

  return response.data.data;
}

export async function getPendingEmail(expectedSession: number, signal: AbortSignal) {
  const response = await instance.get<ApiResponse<PendingEmailChange | null>>('/users/me/email-change', {
    params: { expectedSession },
    signal,
  });

  return response.data.data;
}

export async function requestEmailChange(
  expectedSession: number,
  newEmail: string,
  currentPassword: string,
  signal: AbortSignal,
) {
  const response = await instance.post<ApiResponse<PendingEmailChange>>(
    '/users/me/email-change',
    { newEmail, currentPassword },
    {
      params: { expectedSession },
      signal,
      timeout: 25000,
    },
  );

  return response.data.data;
}

export async function confirmEmailChange(expectedSession: number, token: string, signal: AbortSignal) {
  await instance.post(
    '/users/email-change/confirm',
    { token },
    { params: { expectedSession }, signal, timeout: 25000 },
  );
}

export async function getOwnSessions(expectedSession: number, page: number, limit: number, signal: AbortSignal) {
  const response = await instance.get<PaginatedApiResponse<OwnSession[]>>('/sessions/me', {
    params: { expectedSession, page, limit },
    signal,
  });

  return response.data;
}

export async function revokeOwnSessions(expectedSession: number, signal: AbortSignal, target?: number) {
  const path = target === undefined ? '/sessions/me/others' : `/sessions/me/others/${target}`;

  await instance.patch(path, undefined, { params: { expectedSession }, signal });
}

export async function changeOwnPassword(expectedSession: number, data: PasswordChange, signal: AbortSignal) {
  await instance.patch('/auth/me/password', data, { params: { expectedSession }, signal });
}
