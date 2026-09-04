import type { UserRole } from '@/enums/userRole';
import type { IUser } from '@/interfaces/users/user.interface';

export interface IEnrollmentStudent {
  idEnrollment: number;
  role: UserRole;
  user: IUser;
}
