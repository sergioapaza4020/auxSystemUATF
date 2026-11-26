import { instance } from './config/config';
import type { ApiResponse } from '@/interfaces/apiResponse';

interface AvatarResult {
  avatarVersion: string | null;
}

export async function getAvatar(idUser: number, own: boolean, expectedSession: number, signal: AbortSignal) {
  const path = own ? '/users/me/avatar' : `/users/id/${idUser}/avatar`;

  const response = await instance.get<Blob>(path, {
    responseType: 'blob',
    params: { expectedSession },
    signal,
    timeout: 20000,
  });

  if (response.data.type !== 'image/webp') throw new Error('Formato de fotografía no esperado.');

  return response.data;
}

export async function replaceAvatar(idSession: number, file: File, signal: AbortSignal) {
  const form = new FormData();

  form.append('file', file);

  const response = await instance.put<ApiResponse<AvatarResult>>('/users/me/avatar', form, {
    params: { expectedSession: idSession },
    signal,
    timeout: 30000,
  });

  return response.data.data;
}

export async function removeAvatar(idSession: number, signal: AbortSignal) {
  const response = await instance.delete<ApiResponse<AvatarResult>>('/users/me/avatar', {
    params: { expectedSession: idSession },
    signal,
    timeout: 20000,
  });

  return response.data.data;
}
