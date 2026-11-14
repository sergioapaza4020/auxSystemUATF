import type * as React from 'react';

import { describe, expect, it, vi } from 'vitest';

import { StudentEnrollmentView } from '@/views/admin/enrollments/grades-card/StudentEnrollmentView';
import { StudentGradesView } from '@/views/admin/enrollments/grades-card/StudentGradesView';
import { AcademicCriteria } from '@/views/admin/enrollments/student-record/AcademicCriteria';
import { StudentAttendanceCheckIn } from './StudentAttendanceCheckIn';
import { getMyStudentAttendance } from '@/api/attendances.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { UserRole } from '@/enums/userRole';
import { elements, hookHarness } from '@/test-utils/hook-harness';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/api/attendances.service', () => ({ getMyStudentAttendance: vi.fn() }));

const enrollment: IEnrollment = {
  idEnrollment: 20,
  role: UserRole.STUDENT,
  isActive: true,
  user: { idUser: 5, name: 'Ana', lastname: 'Perez', email: '', ci: '', username: 'ana', isActive: true },
  semester: { idSemester: 1, year: 2026, period: 'II', isActive: true, startDate: '', endDate: '' },
  course: {
    idCourse: 3,
    name: 'Materia',
    code: 'SIS',
    group: 1,
    isActive: true,
    gradeScheme: {
      idGradeScheme: 1,
      name: 'Esquema',
      isActive: true,
      details: [
        {
          idGradeSchemeDetail: 1,
          order: 1,
          percentage: 100,
          gradeItem: { idGradeItem: 1, name: 'Asistencias', isActive: true },
          activities: [],
        },
      ],
    },
  },
};

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

describe('check-in academic refresh integration', () => {
  it('refetches the existing academic view without inflating OPEN attendance and later accepts the closed summary', async () => {
    const initial = { totalSessions: 2, presentSessions: 1, excusedSessions: 0, absentSessions: 1, percentage: 50 };

    const closed = {
      totalSessions: 3,
      presentSessions: 2,
      excusedSessions: 0,
      absentSessions: 1,
      percentage: 66.666667,
    };

    vi.mocked(getMyStudentAttendance).mockResolvedValue(initial);
    const parent = hookHarness(() => StudentEnrollmentView({ enrollment, grades: [], loading: false }));
    let parentTree = parent.render();
    let props = elements<React.ComponentProps<typeof StudentGradesView>>(parentTree, StudentGradesView)[0].props;
    const academic = hookHarness(() => StudentGradesView(props));

    academic.render();
    await flush();
    let tree = academic.render();

    expect(elements<React.ComponentProps<typeof AcademicCriteria>>(tree, AcademicCriteria)[0].props.attendance).toEqual(
      initial,
    );

    // A successful check-in in OPEN requests an academic refresh, but the server totals are unchanged.
    elements<React.ComponentProps<typeof StudentAttendanceCheckIn>>(
      parentTree,
      StudentAttendanceCheckIn,
    )[0].props.onAcademicRefresh();
    parentTree = parent.render();
    props = elements<React.ComponentProps<typeof StudentGradesView>>(parentTree, StudentGradesView)[0].props;
    academic.render();
    await flush();
    tree = academic.render();
    expect(getMyStudentAttendance).toHaveBeenCalledTimes(2);
    expect(elements<React.ComponentProps<typeof AcademicCriteria>>(tree, AcademicCriteria)[0].props.attendance).toEqual(
      initial,
    );

    // The boundary refresh later receives the backend's consolidated result.
    vi.mocked(getMyStudentAttendance).mockResolvedValue(closed);
    elements<React.ComponentProps<typeof StudentAttendanceCheckIn>>(
      parentTree,
      StudentAttendanceCheckIn,
    )[0].props.onAcademicRefresh();
    parentTree = parent.render();
    props = elements<React.ComponentProps<typeof StudentGradesView>>(parentTree, StudentGradesView)[0].props;
    academic.render();
    await flush();
    tree = academic.render();
    expect(getMyStudentAttendance).toHaveBeenCalledTimes(3);
    expect(elements<React.ComponentProps<typeof AcademicCriteria>>(tree, AcademicCriteria)[0].props.attendance).toEqual(
      closed,
    );
    academic.unmount();
    parent.unmount();
  });
});
