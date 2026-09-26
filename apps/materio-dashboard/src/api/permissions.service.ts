import { instance } from './config/config';
import type { IPermissionCreate, IPermissionUpdate } from '@/interfaces/permissions/permission.interface';

export { getPermissions } from './roles.service';

export const createPermission = async (data: IPermissionCreate): Promise<void> => {
  await instance.post('/permissions', { name: data.name.trim(), description: data.description.trim() });
};

// Keys are used by controllers. This UI deliberately only edits descriptions.
export const updatePermission = async (id: number, data: IPermissionUpdate): Promise<void> => {
  await instance.patch(`/permissions/${id}`, { description: data.description.trim() });
};

export const deactivatePermission = async (id: number): Promise<void> => {
  await instance.delete(`/permissions/${id}`);
};

export const reactivatePermission = async (id: number): Promise<void> => {
  await instance.patch(`/permissions/reactivate/${id}`);
};
