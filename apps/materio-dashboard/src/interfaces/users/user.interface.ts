import type { IRole } from '../roles/role.interface';

export interface IUser {
  idUser: number;
  email: string;
  username: string;
  name: string;
  lastname: string;
  avatar?: string | null;
  ci: string;
  ru?: string | null;
  isActive: boolean;
  roles?: Pick<IRole, 'idRole' | 'name' | 'isActive'>[];
}

export interface IUserCreate {
  name: string;
  lastname: string;
  username: string;
  email: string;
  ci: string;
  ru: string;
  password: string;
  roleNames: string[];
}

export type IUserUpdate = Partial<Omit<IUserCreate, 'roleNames'>>;
