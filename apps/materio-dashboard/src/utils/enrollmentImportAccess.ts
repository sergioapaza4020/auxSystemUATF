import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { hasPermission } from './hasPermission';

export function canImportEnrollmentStudents(user: ICurrentUser | null, enrollment: IEnrollment): boolean {
  return (
    hasPermission(user, 'enrollment.create') &&
    enrollment.role === 'ASSISTANT' &&
    enrollment.user.idUser === user?.idUser &&
    enrollment.isActive &&
    enrollment.course.isActive &&
    enrollment.semester.isActive
  );
}
