import * as ReactRuntime from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, createTheme } from '@mui/material/styles';

import { StudentGradesView } from './StudentGradesView';
import { StudentEnrollmentView } from './StudentEnrollmentView';
import { getMyStudentAttendance } from '@/api/attendances.service';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import { UserRole } from '@/enums/userRole';
import { GradeViewToggle } from '../GradeViewToggle';

vi.mock('@/api/attendances.service', () => ({ getMyStudentAttendance: vi.fn() }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactRuntime>('react');

  return { ...actual, useState: vi.fn(actual.useState), useEffect: vi.fn(actual.useEffect) };
});
const actual = await vi.importActual<typeof ReactRuntime>('react');

const activities = [1, 2, 3, 4].map((id) => ({
  idActivity: id,
  name: `Actividad ${id}`,
  dueDate: '2026-10-15',
  isActive: true,
}));

const scheme: IGradeScheme = {
  idGradeScheme: 1,
  name: 'General',
  isActive: true,
  details: [
    {
      idGradeSchemeDetail: 1,
      order: 1,
      percentage: 60,
      gradeItem: { idGradeItem: 1, name: 'Criterio dinámico', isActive: true },
      activities,
    },
    {
      idGradeSchemeDetail: 2,
      order: 2,
      percentage: 30,
      gradeItem: { idGradeItem: 2, name: 'Asistencias', isActive: true },
      activities: [],
    },
    {
      idGradeSchemeDetail: 3,
      order: 3,
      percentage: 10,
      gradeItem: { idGradeItem: 3, name: 'Criterio directo', isActive: true },
      activities: [],
    },
  ],
};

const enrollment: IEnrollment = {
  idEnrollment: 1,
  role: UserRole.STUDENT,
  isActive: true,
  course: { idCourse: 1, isActive: true, name: 'Materia', code: 'SIS', group: 1, gradeScheme: scheme },
  semester: { idSemester: 1, year: 2026, period: 'II', isActive: true, startDate: '', endDate: '' },
  user: { idUser: 5, name: 'Juan', lastname: 'Pérez', username: 'juan', email: '', ci: '', isActive: true },
};

const grades: IGrade[] = [80, 70, null, 0].flatMap((score, index) =>
  score === null
    ? []
    : [
        {
          idGrade: index,
          isActive: true,
          score,
          enrollment,
          activity: activities[index],
          gradeSchemeDetail: { ...scheme.details[0], gradeScheme: { idGradeScheme: 1, name: 'General' } },
        },
      ],
);

const attendance = { totalSessions: 3, presentSessions: 1, excusedSessions: 1, absentSessions: 1, percentage: 50 };
const props = { scheme, grades, loading: false, schemeMultiplier: 1, maximumScore: 100, attendance };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ReactRuntime.useState).mockImplementation(actual.useState);
  vi.mocked(ReactRuntime.useEffect).mockImplementation(actual.useEffect);
});

function text() {
  return renderToStaticMarkup(<StudentGradesView {...props} />)
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '');
}

describe('Mi rendimiento académico', () => {
  it('shows dynamic activities, dates, weighted criteria, attendance and no administrative actions', () => {
    const html = text();

    expect(html).toContain('Mi rendimiento académico');
    expect(html).toContain('22.5 / 60');
    expect(html).toContain('15.0 / 30');
    expect(html).toContain('Actividad 1');
    expect(html).toContain('15 oct 2026');
    expect(html).toContain('1Permisos');
    expect(html).not.toContain('Gestionar');
    expect(html).not.toContain('Ver asistencia');
    expect(renderToStaticMarkup(<StudentGradesView {...props} />)).not.toContain('<input');
  });
  it('keeps zero distinct from a missing Grade and counts all active activities', () => {
    expect(text()).toMatch(/Actividad 3[\s\S]*?--/);
    expect(text()).toMatch(/Actividad 4[\s\S]*?0\.0/);
    expect(text()).toContain('37.5 / 100');
  });
  it('retains the general course scheme for student enrollment', () => {
    expect(
      renderToStaticMarkup(<StudentEnrollmentView enrollment={enrollment} grades={grades} loading={false} />),
    ).toContain('Esquema general de la materia');
  });
  it('shows normalized results without changing activity Grades', () => {
    vi.mocked(ReactRuntime.useState).mockImplementation(((initial: unknown) =>
      actual.useState(initial === 'weighted' ? 'raw' : initial)) as typeof ReactRuntime.useState);
    expect(text()).toContain('37.5 / 100');
    expect(text()).toContain('50.0 / 100');
    expect(grades.map((grade) => grade.score)).toEqual([80, 70, 0]);
  });
  it('shows -- rather than zero when no criterion has a score', () => {
    const emptyScheme = { ...scheme, details: [scheme.details[2]] };

    const html = renderToStaticMarkup(
      <StudentGradesView {...props} scheme={emptyScheme} grades={[]} attendance={null} />,
    )
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, '');

    expect(html).toContain('--');
    expect(html).not.toContain('0.0');
  });
  it('loads attendance once for the own enrollment, never per criterion or activity', async () => {
    let effect: ReactRuntime.EffectCallback = () => {};

    vi.mocked(ReactRuntime.useEffect).mockImplementation((callback) => {
      effect = callback;
    });
    vi.mocked(ReactRuntime.useState).mockImplementation(((initial?: unknown) => [
      initial,
      vi.fn(),
    ]) as typeof ReactRuntime.useState);
    vi.mocked(getMyStudentAttendance).mockResolvedValue(attendance);
    StudentGradesView({ ...props, studentEnrollmentId: 1 });
    const cleanup = effect();

    await Promise.resolve();
    expect(getMyStudentAttendance).toHaveBeenCalledExactlyOnceWith(1);
    if (cleanup) cleanup();
  });
  it('does not request attendance when the scheme has no attendance criterion', () => {
    let effect: ReactRuntime.EffectCallback = () => {};

    vi.mocked(ReactRuntime.useEffect).mockImplementation((callback) => {
      effect = callback;
    });
    vi.mocked(ReactRuntime.useState).mockImplementation(((initial?: unknown) => [
      initial,
      vi.fn(),
    ]) as typeof ReactRuntime.useState);
    StudentGradesView({ ...props, scheme: { ...scheme, details: [scheme.details[0]] }, studentEnrollmentId: 1 });
    effect();
    expect(getMyStudentAttendance).not.toHaveBeenCalled();
  });
  it('changes representation locally without refetching or mutating Grades', () => {
    const setMode = vi.fn();
    let stateIndex = 0;

    vi.mocked(ReactRuntime.useState).mockImplementation(((initial?: unknown) => [
      initial,
      stateIndex++ === 0 ? setMode : vi.fn(),
    ]) as typeof ReactRuntime.useState);
    vi.mocked(ReactRuntime.useEffect).mockImplementation(() => {});
    const tree = StudentGradesView(props);
    let toggle: ReactRuntime.ReactElement<{ onChange: (mode: string) => void }> | null = null;

    const visit = (node: ReactRuntime.ReactNode) =>
      ReactRuntime.Children.forEach(node, (child) => {
        if (
          !ReactRuntime.isValidElement<{ children?: ReactRuntime.ReactNode; onChange: (mode: string) => void }>(child)
        )
          return;

        if (child.type === GradeViewToggle) {
          toggle = child;
          child.props.onChange('raw');
        }

        visit(child.props.children);
      });

    visit(tree);
    expect(toggle).not.toBeNull();
    expect(setMode).toHaveBeenCalledWith('raw');
    expect(getMyStudentAttendance).not.toHaveBeenCalled();
    expect(grades.map((grade) => grade.score)).toEqual([80, 70, 0]);
  });
  it('shows no sessions distinctly from a failed attendance request', () => {
    const html = renderToStaticMarkup(
      <StudentGradesView
        {...props}
        attendance={{ totalSessions: 0, presentSessions: 0, excusedSessions: 0, absentSessions: 0, percentage: 0 }}
      />,
    );

    expect(html).toContain('Sin sesiones de asistencia');
  });
  it('retains the course header and no-scheme state', () => {
    const html = renderToStaticMarkup(
      <StudentEnrollmentView
        enrollment={{ ...enrollment, course: { ...enrollment.course, gradeScheme: undefined } }}
        grades={[]}
        loading={false}
      />,
    );

    expect(html).toContain('SIS');
    expect(html).toContain('Esquema general de la materia');
    expect(html).toContain('todavía no tiene un esquema');
  });
  it.each(['light', 'dark'] as const)('renders the read-only details in %s mode', (mode) => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <StudentGradesView {...props} />
      </ThemeProvider>,
    );

    expect(html).toContain('Actividad 1');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Gestionar');
  });
});
