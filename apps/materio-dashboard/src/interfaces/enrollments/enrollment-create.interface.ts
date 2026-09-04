import type { UserRole } from '@/enums/userRole';

export interface IEnrollmentCreate {
  username: string;
  courseCode: string;
  role: UserRole;
  semester: string;
}
