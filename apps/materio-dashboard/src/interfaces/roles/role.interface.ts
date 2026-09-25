import type { IPermission } from '../permissions/permission.interface';

export interface IRole {
  idRole: number;
  name: string;
  description?: string;
  isActive: boolean;
  permissions: IPermission[];
}

export interface IRoleCreate {
  name: string;
  description?: string;
  permissionNames: string[];
}
