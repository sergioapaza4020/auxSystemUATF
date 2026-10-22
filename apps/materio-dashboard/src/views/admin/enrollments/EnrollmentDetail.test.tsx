import type * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Grid } from '@mui/material';

import { UserRole } from '@/enums/userRole';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IAssistantGradeScheme } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { EnrollmentDetail } from './EnrollmentDetail';
import { GradeSchemeCard } from './GradeSchemeCard';
import { AssistantGradeSchemeCard } from './AssistantGradeSchemeCard';
import { AssistantGradeSchemeDialog } from './AssistantGradeSchemeDialog';
import { ActivityManagementDialog } from './ActivityManagementDialog';
import { EnrollmentStudentsCard } from './EnrollmentStudentsCard';
import { StudentEnrollmentView } from './grades-card/StudentEnrollmentView';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  removeActivity: vi.fn(),
  roster: { students: [], summary: null, loading: false, error: null, reload: vi.fn() },
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { roles: ['SUPERADMIN'], permissions: [] } }) }));
vi.mock('@/hooks/grade-items', () => ({ useGradeItems: () => ({ gradeItems: [], loading: false }) }));
vi.mock('@/hooks/activities/useActivities', () => ({
  useActivities: () => ({
    activities: [],
    loading: false,
    saving: false,
    create: mocks.createActivity,
    update: mocks.updateActivity,
    remove: mocks.removeActivity,
  }),
}));
vi.mock('@/hooks/enrollments/useEnrollmentStudentsPage', () => ({ useEnrollmentStudentsPage: () => mocks.roster }));
vi.mock('./AssistantGradeSchemeDialog', () => ({ AssistantGradeSchemeDialog: () => null }));
vi.mock('./ActivityManagementDialog', () => ({ ActivityManagementDialog: () => null }));
vi.mock('./EnrollmentStudentsCard', () => ({ EnrollmentStudentsCard: () => <p>Estudiantes</p> }));

type Props = Parameters<typeof EnrollmentDetail>[0];

const scheme: IAssistantGradeScheme = {
  idGradeScheme: 9,
  name: 'Configuración propia',
  assistantPercentage: 20,
  isActive: true,
  details: [],
};

function fixture() {
  const enrollment = {
    idEnrollment: 7,
    role: UserRole.ASSISTANT,
    isActive: true,
    user: { idUser: 5 },
    course: { idCourse: 3, code: 'SIS', name: 'Materia', group: 1, isActive: true },
    semester: { period: 'II', year: 2026 },
  } as IEnrollment;

  const props: Props = {
    enrollment,
    grades: [],
    students: [],
    loadingGrades: false,
    loadingStudents: false,
    assistantGradeScheme: scheme,
    loadingAssistantGradeScheme: false,
    savingAssistantGradeScheme: false,
    onActivitiesChanged: vi.fn(),
    onCreateAssistantGradeScheme: vi.fn().mockResolvedValue(scheme),
    onUpdateAssistantGradeScheme: vi.fn().mockResolvedValue(scheme),
  };

  const h = hookHarness(() => {
    const element = EnrollmentDetail(props);

    return (element.type as (props: Props) => React.ReactElement)(element.props);
  });

  return { props, ...h };
}

const one = <P,>(tree: React.ReactNode, type: unknown) => elements<P>(tree, type)[0].props;

beforeEach(() => vi.clearAllMocks());
describe('Assistant subject detail', () => {
  it('does not read or render the general scheme, including its missing state, and uses the full row', () => {
    const h = fixture();

    Object.defineProperty(h.props.enrollment.course, 'gradeScheme', {
      get: () => {
        throw new Error('General scheme must not be read');
      },
    });
    const tree = h.render();

    expect(elements(tree, GradeSchemeCard)).toHaveLength(0);
    const html = renderToStaticMarkup(tree);

    expect(html).not.toContain('Esquema general de la materia');
    expect(html).not.toContain('Esta materia todavía no tiene un esquema');
    expect(html).toContain('Configuración de evaluación del auxiliar');
    expect(html).toContain('Estudiantes');
    expect(
      elements<React.ComponentProps<typeof Grid>>(tree, Grid)
        .filter((item) => item.props.item)
        .map((item) => item.props.lg),
    ).toEqual([12]);
    h.unmount();
  });
  it('keeps configuration editing and activity actions connected to the assistant scheme', async () => {
    const h = fixture();

    one<React.ComponentProps<typeof AssistantGradeSchemeCard>>(h.render(), AssistantGradeSchemeCard).onConfigure();
    let dialog = one<React.ComponentProps<typeof AssistantGradeSchemeDialog>>(h.render(), AssistantGradeSchemeDialog);

    expect(dialog.open).toBe(true);
    expect(dialog.initialValue?.assistantPercentage).toBe(20);
    const data = { assistantPercentage: 20, name: 'Actualizada', details: [] };

    await dialog.onSubmit(data);
    expect(h.props.onUpdateAssistantGradeScheme).toHaveBeenCalledWith(9, data);
    expect(
      one<React.ComponentProps<typeof AssistantGradeSchemeDialog>>(h.render(), AssistantGradeSchemeDialog).open,
    ).toBe(false);
    one<React.ComponentProps<typeof AssistantGradeSchemeCard>>(h.render(), AssistantGradeSchemeCard).onManageActivities(
      4,
      'Prácticas',
    );
    const activities = one<React.ComponentProps<typeof ActivityManagementDialog>>(h.render(), ActivityManagementDialog);

    expect(activities.open).toBe(true);
    expect(activities.idGradeSchemeDetail).toBe(4);
    expect(activities.onCreate).toBe(mocks.createActivity);
    expect(activities.onUpdate).toBe(mocks.updateActivity);
    expect(activities.onDelete).toBe(mocks.removeActivity);
    h.props.assistantGradeScheme = null;
    dialog = one<React.ComponentProps<typeof AssistantGradeSchemeDialog>>(h.render(), AssistantGradeSchemeDialog);
    await dialog.onSubmit(data);
    expect(h.props.onCreateAssistantGradeScheme).toHaveBeenCalledWith(data);
    h.unmount();
  });
  it('preserves roster, Grade Matrix, attendance and individual record navigation', () => {
    const h = fixture();
    const tree = h.render();
    const students = one<React.ComponentProps<typeof EnrollmentStudentsCard>>(tree, EnrollmentStudentsCard);

    expect(students.pagination).toBe(mocks.roster);
    students.onManageGrades?.();
    students.onManageAttendance?.();
    students.onSelectStudent({ idEnrollment: 15 } as Parameters<typeof students.onSelectStudent>[0]);
    one<React.ComponentProps<typeof AssistantGradeSchemeCard>>(tree, AssistantGradeSchemeCard).onManageAttendance();
    expect(mocks.push.mock.calls.map(([path]) => path)).toEqual([
      '/dashboard/enrollments/7/grades',
      '/dashboard/enrollments/7/attendance',
      '/dashboard/enrollments/7/students/15',
      '/dashboard/enrollments/7/attendance',
    ]);
    h.unmount();
  });
  it('keeps the separate student view and its general scheme consumer', () => {
    const h = fixture();

    h.props.enrollment.role = UserRole.STUDENT;
    const tree = EnrollmentDetail(h.props);

    expect(tree.type).toBe(StudentEnrollmentView);
    expect(tree.props.enrollment).toBe(h.props.enrollment);
  });
});
