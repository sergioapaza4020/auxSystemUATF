import type { IUser } from '../users/user.interface';

export interface IFacultyOption {
  idFaculty: number;
  name: string;
}
export interface ICareer {
  idCareer: number;
  name: string;
  isActive: boolean;
  faculty?: IFacultyOption;
  director?: IUser;
}
export interface ICareerCreate {
  name: string;
  idFaculty: number;
  idDirector: number;
  idMembers: number[];
}
export type ICareerUpdate = Partial<ICareerCreate>;
