import { instance } from './config/config';
import type { UserQuery } from '@/interfaces/users/user-query.interface';
import type { IUser, IUserCreate, IUserUpdate } from '@/interfaces/users/user.interface';
import type { ApiResponse, PaginatedApiResponse } from '@/interfaces/apiResponse';
import type {
  IUserImportPreview,
  IUserImportExecution,
  UserImportPreviewQuery,
} from '@/interfaces/users/user-import.interface';

export const getUsersPage = async (query?: UserQuery, signal?: AbortSignal): Promise<PaginatedApiResponse<IUser[]>> => {
  const response = await instance.get<PaginatedApiResponse<IUser[]>>('/users', {
    params: {
      ...query,
      role: query?.role?.length ? query.role.join(',') : undefined,
    },
    signal,
  });

  return response.data;
};

export const getUsers = async (query?: UserQuery): Promise<IUser[]> => {
  return (await getUsersPage(query)).data;
};

export const getUserById = async (id: number, signal?: AbortSignal): Promise<IUser | null> => {
  const response = await instance.get<ApiResponse<IUser | null>>(`/users/id/${id}`, { signal });

  return response.data.data;
};

export const createUser = async (data: IUserCreate): Promise<void> => {
  await instance.post('/users', data);
};

export const updateUser = async (id: number, data: IUserUpdate): Promise<void> => {
  await instance.patch(`/users/${id}`, data);
};

export const deactivateUser = async (id: number): Promise<void> => {
  await instance.delete(`/users/${id}`);
};

export const reactivateUser = async (id: number): Promise<void> => {
  await instance.patch(`/users/reactivate/${id}`);
};

export const addUserRoles = async (id: number, roleNames: string[]): Promise<void> => {
  await instance.patch(`/users/assign-roles/${id}`, { roleNames });
};

export const downloadUserImportTemplate = async (roleName: string): Promise<Blob> => {
  const response = await instance.get('/users/import/template', {
    params: {
      roleName,
    },
    responseType: 'blob',
  });

  return response.data as Blob;
};

export const previewUserImport = async (file: File, roleName: string): Promise<IUserImportPreview> => {
  const formData = new FormData();

  formData.append('file', file);
  formData.append('roleName', roleName);

  const response = await instance.post<ApiResponse<IUserImportPreview>>('/users/import/preview', formData);

  return response.data.data;
};

export const confirmUserImport = async (operationId: string): Promise<IUserImportExecution> => {
  const response = await instance.post<ApiResponse<IUserImportExecution>>(`/users/import/${operationId}/confirm`);

  return response.data.data;
};

export const getUserImportStatus = async (operationId: string, signal?: AbortSignal): Promise<IUserImportExecution> => {
  const response = await instance.get<ApiResponse<IUserImportExecution>>(`/users/import/${operationId}/status`, {
    signal,
  });

  return response.data.data;
};

export const getUserImportPreviewPage = async (
  operationId: string,
  query: UserImportPreviewQuery,
  signal?: AbortSignal,
): Promise<IUserImportPreview> => {
  const response = await instance.get<ApiResponse<IUserImportPreview>>(`/users/import/preview/${operationId}`, {
    params: { ...query, search: query.search.trim() || undefined },
    signal,
  });

  return response.data.data;
};
