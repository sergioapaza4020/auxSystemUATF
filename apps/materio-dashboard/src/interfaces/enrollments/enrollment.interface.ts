import type { UserRole } from '@/enums/userRole';
import type { ICourse } from '../courses/course.interface';
import type { ISemester } from '../semesters/semester.interface';
import type { IUser } from '../users/user.interface';

export interface IEnrollment {
  idEnrollment: number;
  isActive: boolean;
  role: UserRole;
  course: ICourse;
  semester: ISemester;
  user: IUser;
}

export type IMyEnrollment = Pick<IEnrollment, 'idEnrollment' | 'role' | 'isActive' | 'course' | 'semester'>;
