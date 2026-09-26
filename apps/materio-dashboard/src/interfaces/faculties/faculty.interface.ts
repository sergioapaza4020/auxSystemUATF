import type { IUser } from '@/interfaces/users/user.interface';

export interface IFaculty {
  idFaculty: number;
  name: string;
  isActive: boolean;
  dean?: IUser;
}
export interface IFacultyWrite {
  name: string;
  idDean: number;
  idCareers?: number[];
}
