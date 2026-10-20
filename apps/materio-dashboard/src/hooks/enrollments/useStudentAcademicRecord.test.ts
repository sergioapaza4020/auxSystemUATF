import * as React from 'react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getManagedEnrollment, getIndividualStudentGradeSummary } from '@/api/enrollments.service';
import { getMyAssistantGradeScheme } from '@/api/assistant-grade-schemes.service';
import { getGradesByEnrollment } from '@/api/grades.service';
import { getStudentAttendance } from '@/api/attendances.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { UserRole } from '@/enums/userRole';
import { useStudentAcademicRecord } from './useStudentAcademicRecord';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(), useEffect: vi.fn() };
});
vi.mock('@/api/enrollments.service', () => ({
  getManagedEnrollment: vi.fn(),
  getIndividualStudentGradeSummary: vi.fn(),
}));
vi.mock('@/api/assistant-grade-schemes.service', () => ({ getMyAssistantGradeScheme: vi.fn() }));
vi.mock('@/api/grades.service', () => ({ getGradesByEnrollment: vi.fn() }));
vi.mock('@/api/attendances.service', () => ({ getStudentAttendance: vi.fn() }));

const enrollment: IEnrollment = {
  idEnrollment: 10,
  isActive: true,
  role: UserRole.STUDENT,
  course: { idCourse: 8, code: 'SIS', name: 'Materia', group: 1, isActive: true },
  semester: { idSemester: 1, year: 2026, period: 'II', isActive: true, startDate: '', endDate: '' },
  user: { idUser: 1, name: 'Juan', lastname: 'Pérez', username: 'juan', email: '', ci: '', isActive: true },
};

afterEach(() => vi.resetAllMocks());

function useMount() {
  const setters = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
  let stateIndex = 0;
  let effect: React.EffectCallback = () => {};

  vi.mocked(React.useState).mockImplementation(((initial: unknown) => [
    initial,
    setters[stateIndex++],
  ]) as unknown as typeof React.useState);
  vi.mocked(React.useEffect).mockImplementation((callback) => {
    effect = callback;
  });
  vi.mocked(getIndividualStudentGradeSummary).mockResolvedValue({
    scheme: null,
    student: { idEnrollment: 10, details: [], totalRaw: null, assistantContribution: null },
  });
  vi.mocked(getManagedEnrollment).mockResolvedValue(enrollment);
  vi.mocked(getMyAssistantGradeScheme).mockResolvedValue(null);
  vi.mocked(getGradesByEnrollment).mockResolvedValue([]);
  vi.mocked(getStudentAttendance).mockResolvedValue({
    totalSessions: 0,
    presentSessions: 0,
    excusedSessions: 0,
    absentSessions: 0,
    percentage: 0,
  });
  useStudentAcademicRecord(7, 10);
  const cleanup = effect();

  return { setters, cleanup };
}

describe('Academic record read loading', () => {
  it('uses existing services with the selected student and assistant enrollment', async () => {
    const { setters } = useMount();

    await vi.waitFor(() => expect(setters[1]).toHaveBeenLastCalledWith(false));
    expect(getIndividualStudentGradeSummary).toHaveBeenCalledWith(7, 10);
    expect(getManagedEnrollment).toHaveBeenCalledWith(10, false);
    expect(getMyAssistantGradeScheme).toHaveBeenCalledWith(8, 7);
    expect(getGradesByEnrollment).toHaveBeenCalledWith(10);
    expect(getStudentAttendance).toHaveBeenCalledWith(10);
    expect(setters[0]).toHaveBeenLastCalledWith(expect.objectContaining({ enrollment, scheme: null, grades: [] }));
  });
  it('rejects an invalid parent context before loading grades or attendance', async () => {
    vi.mocked(getIndividualStudentGradeSummary).mockRejectedValueOnce(
      new Error('No se encontró al estudiante en esta materia.'),
    );
    const { setters } = useMount();

    await vi.waitFor(() =>
      expect(setters[2]).toHaveBeenLastCalledWith('No se encontró al estudiante en esta materia.'),
    );
    expect(getManagedEnrollment).not.toHaveBeenCalled();
    expect(getGradesByEnrollment).not.toHaveBeenCalled();
    expect(getStudentAttendance).not.toHaveBeenCalled();
  });
  it('handles enrollment loading errors', async () => {
    vi.mocked(getManagedEnrollment).mockRejectedValueOnce(new Error('No se encontró al estudiante'));
    const { setters } = useMount();

    await vi.waitFor(() => expect(setters[2]).toHaveBeenLastCalledWith('No se encontró al estudiante'));
    expect(getGradesByEnrollment).not.toHaveBeenCalled();
  });
  it.each(['scheme', 'grades'])('does not present failed %s requests as empty data', async (resource) => {
    const service = resource === 'scheme' ? getMyAssistantGradeScheme : getGradesByEnrollment;

    vi.mocked(service).mockRejectedValueOnce(new Error('No disponible'));
    const { setters } = useMount();

    await vi.waitFor(() => expect(setters[2]).toHaveBeenLastCalledWith('No disponible'));
    expect(setters[0]).toHaveBeenCalledTimes(1);
    expect(setters[0]).toHaveBeenCalledWith(null);
  });
  it('retains grades when attendance alone fails and exposes that error', async () => {
    vi.mocked(getStudentAttendance).mockRejectedValueOnce(new Error('Asistencia no disponible'));
    const { setters } = useMount();

    await vi.waitFor(() =>
      expect(setters[0]).toHaveBeenLastCalledWith(
        expect.objectContaining({ attendance: null, attendanceError: 'Asistencia no disponible' }),
      ),
    );
  });
  it('ignores a response after route change or unmount', async () => {
    const { setters, cleanup } = useMount();

    if (cleanup) cleanup();
    await getManagedEnrollment(10);
    await Promise.resolve();
    await Promise.resolve();
    expect(setters[0]).toHaveBeenCalledTimes(1);
    expect(setters[1]).not.toHaveBeenCalledWith(false);
  });
});
