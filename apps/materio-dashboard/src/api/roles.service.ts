import type { ApiResponse } from '@/interfaces/apiResponse';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { instance } from './config/config';

import type { IRole, IRoleCreate } from '@/interfaces/roles/role.interface';

import type { IPermission } from '@/interfaces/permissions/permission.interface';

export const getRoles = async (): Promise<IRole[]> => {
  const response = await instance.get('/roles');

  return response.data.data;
};

export const getPermissions = async (status?: RecordStatus): Promise<IPermission[]> => {
  const response = await instance.get<ApiResponse<IPermission[]>>('/permissions', { params: { status } });

  return response.data.data;
};

export const createRole = async (data: IRoleCreate): Promise<IRole> => {
  const response = await instance.post('/roles', data);

  return response.data.data;
};

export const assignRolePermissions = async (idRole: number, permissionNames: string[]): Promise<IRole> => {
  const response = await instance.patch(`/roles/assign-permissions/${idRole}`, {
    permissionNames,
  });

  return response.data.data;
};

export const updateRole = async (idRole: number, data: IRoleCreate): Promise<IRole> => {
  const response = await instance.put(`/roles/${idRole}`, data);

  return response.data.data;
};

export const deleteRole = async (idRole: number): Promise<IRole> => {
  const response = await instance.delete(`/roles/${idRole}`);

  return response.data.data;
};

export const reactivateRole = async (idRole: number): Promise<IRole> => {
  const response = await instance.patch(`/roles/reactivate/${idRole}`);

  return response.data.data;
};
