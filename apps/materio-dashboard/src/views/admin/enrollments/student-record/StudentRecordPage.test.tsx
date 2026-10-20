import * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Page from '@/app/dashboard/enrollments/[idEnrollment]/students/[studentEnrollmentId]/page';
import { UserRole } from '@/enums/userRole';
import type { useStudentAcademicRecord } from '@/hooks/enrollments/useStudentAcademicRecord';
import type { useStudentGradeSummary } from '@/hooks/enrollments/useStudentGradeSummary';
import { StudentAcademicRecord } from './StudentAcademicRecord';
import { GradesCard } from '../grades-card/GradesCard';

const mocks = vi.hoisted(() => ({
  permissions: ['enrollment.get-managed-enrollment', 'grade.get-by-enrollment', 'grade.create', 'grade.update'],
  params: { idEnrollment: '7', studentEnrollmentId: '10' },
  record: vi.fn(),
  summary: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useParams: () => mocks.params }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { roles: [], permissions: mocks.permissions } }) }));
vi.mock('@/hooks/enrollments/useStudentAcademicRecord', () => ({ useStudentAcademicRecord: mocks.record }));
vi.mock('@/hooks/enrollments/useStudentGradeSummary', () => ({ useStudentGradeSummary: mocks.summary }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(actual.useState) };
});
const actual = await vi.importActual<typeof React>('react');

function recordState(): ReturnType<typeof useStudentAcademicRecord> {
  return {
    loading: false,
    error: null,
    revision: 0,
    reload: vi.fn(),
    record: {
      enrollment: {
        idEnrollment: 10,
        isActive: true,
        role: UserRole.STUDENT,
        course: { idCourse: 1, name: 'Materia', code: 'SIS', group: 1, isActive: true },
        semester: { idSemester: 1, isActive: true, year: 2026, period: 'II', startDate: '', endDate: '' },
        user: {
          idUser: 1,
          name: 'Juan',
          lastname: 'Pérez',
          ci: '123',
          ru: '456',
          username: 'juan',
          email: '',
          isActive: true,
        },
      },
      scheme: {
        idGradeScheme: 1,
        name: 'Auxiliar',
        assistantPercentage: 20,
        isActive: true,
        details: [
          {
            idGradeSchemeDetail: 1,
            order: 1,
            percentage: 60,
            gradeItem: { idGradeItem: 1, name: 'Actividades', isActive: true },
            activities: [{ idActivity: 1, name: 'Entrega', dueDate: '2026-10-15', isActive: true }],
          },
          {
            idGradeSchemeDetail: 2,
            order: 2,
            percentage: 20,
            gradeItem: { idGradeItem: 2, name: 'Asistencias', isActive: true },
            activities: [],
          },
          {
            idGradeSchemeDetail: 3,
            order: 3,
            percentage: 20,
            gradeItem: { idGradeItem: 3, name: 'Oral', isActive: true },
            activities: [],
          },
        ],
      },
      summary: {
        scheme: { idGradeScheme: 1, assistantPercentage: 20, details: [] },
        student: { idEnrollment: 10, details: [], totalRaw: null, assistantContribution: null },
      },
      grades: [],
      attendance: null,
      attendanceError: null,
    },
  };
}

function summaryState(): ReturnType<typeof useStudentGradeSummary> {
  return {
    loading: false,
    error: null,
    reload: vi.fn(),
    summary: {
      scheme: { idGradeScheme: 1, assistantPercentage: 20, details: [] },
      students: [{ idEnrollment: 10, details: [], totalRaw: null, assistantContribution: null }],
    },
  };
}

function nodes(tree: React.ReactNode, type: unknown): React.ReactElement<Record<string, unknown>>[] {
  const result: React.ReactElement<Record<string, unknown>>[] = [];

  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === type) result.push(child);
    result.push(...nodes(child.props.children as React.ReactNode, type));
  });

  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(React.useState).mockImplementation(actual.useState);
  mocks.permissions = ['enrollment.get-managed-enrollment', 'grade.get-by-enrollment', 'grade.create', 'grade.update'];
  mocks.params = { idEnrollment: '7', studentEnrollmentId: '10' };
  mocks.record.mockReturnValue(recordState());
  mocks.summary.mockReturnValue(summaryState());
});

describe('Academic record page integration', () => {
  it('does not load data without viewing permission', () => {
    mocks.permissions = [];
    expect(renderToStaticMarkup(<Page />)).toContain('No tienes permiso');
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('rejects invalid route IDs before data requests', () => {
    mocks.params.studentEnrollmentId = 'invalid';
    expect(renderToStaticMarkup(<Page />)).toContain('no es válida');
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it('shows loading and load errors', () => {
    mocks.record.mockReturnValue({ ...recordState(), loading: true });
    expect(renderToStaticMarkup(<Page />)).toContain('Cargando ficha académica');
    mocks.record.mockReturnValue({ ...recordState(), error: 'Fallo de carga' });
    expect(renderToStaticMarkup(<Page />)).toContain('Fallo de carga');
    expect(renderToStaticMarkup(<Page />)).toContain('Reintentar');
  });
  it('renders from direct route IDs without querying the group summary', () => {
    expect(renderToStaticMarkup(<Page />)).toContain('Juan');
    expect(mocks.record).toHaveBeenCalledWith(7, 10, false);
    expect(mocks.summary).not.toHaveBeenCalled();
  });
  it('rejects an unexpected student identity', () => {
    const state = recordState();

    state.record!.summary.student.idEnrollment = 99;
    mocks.record.mockReturnValue(state);
    expect(renderToStaticMarkup(<Page />)).toContain('No se encontró al estudiante en esta materia');
  });
  it('hides Matrix action without both edit permissions', () => {
    mocks.permissions = ['enrollment.get-managed-enrollment', 'grade.get-by-enrollment', 'grade.update'];
    expect(renderToStaticMarkup(<Page />)).not.toContain('Gestionar calificaciones');
    mocks.permissions.push('grade.create');
    expect(renderToStaticMarkup(<Page />)).toContain('Gestionar calificaciones');
  });
  it('keeps the exceptional editor restricted to direct criteria and honors delete permission', () => {
    vi.mocked(React.useState).mockReturnValue([true, vi.fn()]);
    const root = Page();
    const content = root.type as (props: typeof root.props) => React.ReactElement;
    const tree = content(root.props);
    const editor = nodes(tree, GradesCard)[0];

    expect(editor.props.canDelete).toBe(false);
    expect(editor.props.gradeScheme).toMatchObject({ details: [{ idGradeSchemeDetail: 3, activities: [] }] });
    expect(nodes(tree, StudentAcademicRecord)[0].props.canEdit).toBe(true);
    mocks.permissions.push('grade.remove');
    expect(nodes(content(root.props), GradesCard)[0].props.canDelete).toBe(true);
  });
});
