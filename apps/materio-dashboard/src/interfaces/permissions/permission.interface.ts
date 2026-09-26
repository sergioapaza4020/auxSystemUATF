export interface IPermission {
  idPermission: number;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface IPermissionCreate {
  name: string;
  description: string;
}

export type IPermissionUpdate = Pick<IPermissionCreate, 'description'>;
