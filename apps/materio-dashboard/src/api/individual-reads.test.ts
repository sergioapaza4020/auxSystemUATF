import { beforeEach, describe, expect, it, vi } from 'vitest';

import { instance } from './config/config';
import { getIndividualStudentGradeSummary, getManagedEnrollment } from './enrollments.service';
import { getUserById } from './users.service';
import { getCurrentUser } from './auth.service';
import { hasPermission } from '@/utils/hasPermission';

vi.mock('./config/config', () => ({ instance: { get: vi.fn() } }));
vi.mock('./config/refreshInstance', () => ({ refreshInstance: {} }));
beforeEach(() => vi.resetAllMocks());

describe('Individual read contracts', () => {
  it('requests one contextual student summary and unwraps the existing API envelope', async () => {
    const summary = {
      scheme: null,
      student: { idEnrollment: 300, details: [], totalRaw: null, assistantContribution: null },
    };

    vi.mocked(instance.get).mockResolvedValue({ data: { status: true, data: summary } });
    expect(await getIndividualStudentGradeSummary(7, 300)).toEqual(summary);
    expect(instance.get).toHaveBeenCalledWith('/enrollments/7/students/300/grade-summary');
    expect(instance.get).toHaveBeenCalledTimes(1);
  });
  it('opts out of the unused course scheme without changing the default for other consumers', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: { idEnrollment: 300 } } });
    await getManagedEnrollment(300, false);
    expect(instance.get).toHaveBeenLastCalledWith('/enrollments/managed/300', {
      params: { includeCourseScheme: false },
    });
    await getManagedEnrollment(300);
    expect(instance.get).toHaveBeenLastCalledWith('/enrollments/managed/300', {
      params: { includeCourseScheme: true },
    });
  });
  it('propagates contextual summary errors', async () => {
    vi.mocked(instance.get).mockResolvedValue({
      data: { status: false, message: 'No se encontró al estudiante en esta materia.' },
    });
    await expect(getIndividualStudentGradeSummary(7, 300)).rejects.toThrow('No se encontró al estudiante');
  });
  it('keeps user detail usable without enrollment collections', async () => {
    const user = { idUser: 1, name: 'Ana', roles: [{ idRole: 2, name: 'ADMIN', isActive: true }] };

    vi.mocked(instance.get).mockResolvedValue({ data: { status: true, data: user } });
    const controller = new AbortController();

    expect(await getUserById(1, controller.signal)).toEqual(user);
    expect(instance.get).toHaveBeenCalledWith('/users/id/1', { signal: controller.signal });
  });
  it('preserves the complete session used by auth context and permission controls', async () => {
    const session = {
      idUser: 1,
      roles: ['ASSISTANT'],
      permissions: ['grade.get-by-enrollment', 'attendance.student.get', 'user.get-by-id'],
    };

    vi.mocked(instance.get).mockResolvedValue({ data: { status: true, data: session } });
    const user = await getCurrentUser();

    expect(user).toEqual(session);
    for (const permission of session.permissions) expect(hasPermission(user, permission)).toBe(true);
    expect(instance.get).toHaveBeenCalledWith('/auth/me');
  });
  it('preserves SUPERADMIN bypass even without assigned permissions', async () => {
    vi.mocked(instance.get).mockResolvedValue({ data: { data: { roles: ['SUPERADMIN'], permissions: [] } } });
    expect(hasPermission(await getCurrentUser(), 'grade.get-by-enrollment')).toBe(true);
  });
});
