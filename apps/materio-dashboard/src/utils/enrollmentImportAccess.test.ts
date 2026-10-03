import { describe, expect, it } from 'vitest';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { UserRole } from '../enums/userRole';
import { canImportEnrollmentStudents } from './enrollmentImportAccess';

const user: ICurrentUser = {
  idUser: 7,
  idSession: 1,
  name: 'Ana',
  username: 'ana',
  email: 'ana@example.com',
  roles: ['ASSISTANT'],
  permissions: ['enrollment.create'],
};

const enrollment = {
  idEnrollment: 42,
  isActive: true,
  role: UserRole.ASSISTANT,
  user: { idUser: 7 },
  course: { idCourse: 10, isActive: true },
  semester: { idSemester: 20, isActive: true },
} as IEnrollment;

describe('Import access from the assistant student list', () => {
  it('requires the create permission and preserves SUPERADMIN bypass', () => {
    expect(canImportEnrollmentStudents(user, enrollment)).toBe(true);
    expect(canImportEnrollmentStudents({ ...user, permissions: [] }, enrollment)).toBe(false);
    expect(canImportEnrollmentStudents({ ...user, permissions: [], roles: ['SUPERADMIN'] }, enrollment)).toBe(true);
  });
  it('preserves ownership, assistant role and active academic context', () => {
    expect(canImportEnrollmentStudents(null, enrollment)).toBe(false);
    expect(canImportEnrollmentStudents({ ...user, idUser: 8 }, enrollment)).toBe(false);
    expect(canImportEnrollmentStudents(user, { ...enrollment, role: UserRole.STUDENT })).toBe(false);
    expect(canImportEnrollmentStudents(user, { ...enrollment, isActive: false })).toBe(false);
    expect(
      canImportEnrollmentStudents(user, { ...enrollment, course: { ...enrollment.course, isActive: false } }),
    ).toBe(false);
    expect(
      canImportEnrollmentStudents(user, { ...enrollment, semester: { ...enrollment.semester, isActive: false } }),
    ).toBe(false);
  });
});
