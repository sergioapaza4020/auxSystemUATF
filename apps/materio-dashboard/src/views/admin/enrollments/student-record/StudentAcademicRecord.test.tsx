import * as ReactRuntime from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { averageScores, weightedScore } from '@repo/grade-calculations';
import { Box, Card } from '@mui/material';
import { createTheme, ThemeProvider } from '@mui/material/styles';

import { UserRole } from '@/enums/userRole';
import { studentCriterionResult } from '@/hooks/grades/grade-matrix-state';
import { createGrade, updateGrade, deleteGrade } from '@/api/grades.service';
import { StudentAcademicRecord, type StudentAcademicRecordProps } from './StudentAcademicRecord';
import { GradeViewToggle } from '../GradeViewToggle';
import { AcademicCriteria, type AcademicCriteriaProps } from './AcademicCriteria';

vi.mock('@/api/grades.service', () => ({ createGrade: vi.fn(), updateGrade: vi.fn(), deleteGrade: vi.fn() }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactRuntime>('react');

  return { ...actual, useState: vi.fn(actual.useState) };
});
const actual = await vi.importActual<typeof ReactRuntime>('react');

function fixture(): StudentAcademicRecordProps {
  const enrollment: StudentAcademicRecordProps['enrollment'] = {
    idEnrollment: 10,
    isActive: true,
    role: UserRole.STUDENT,
    course: { idCourse: 1, isActive: true, code: 'SIS-414', name: 'Tecnologías emergentes', group: 1 },
    semester: {
      idSemester: 1,
      isActive: true,
      year: 2026,
      period: 'II',
      startDate: '2026-07-01',
      endDate: '2026-12-01',
    },
    user: {
      idUser: 1,
      name: 'Juan',
      lastname: 'Pérez',
      ci: '1234567',
      ru: '2019001',
      username: 'juan',
      email: 'juan@example.com',
      isActive: true,
    },
  };

  const activities = [80, 70, null, 0].map((_, index) => ({
    idActivity: index + 1,
    isActive: true,
    name: `Entrega ${index + 1}`,
    dueDate: '2026-10-15',
  }));

  const details = [
    {
      idGradeSchemeDetail: 1,
      percentage: 60,
      order: 1,
      gradeItem: { idGradeItem: 1, name: 'Proyectos dinámicos', isActive: true },
      activities,
    },
    {
      idGradeSchemeDetail: 2,
      percentage: 30,
      order: 2,
      gradeItem: { idGradeItem: 2, name: 'Asistencias', isActive: true },
      activities: [{ ...activities[0], name: 'NO ES ACTIVIDAD' }],
    },
    {
      idGradeSchemeDetail: 3,
      percentage: 10,
      order: 3,
      gradeItem: { idGradeItem: 3, name: 'Evaluación oral', isActive: true },
      activities: [],
    },
  ];

  return {
    idEnrollment: 7,
    enrollment,
    scheme: { idGradeScheme: 1, name: 'Auxiliar', assistantPercentage: 20, isActive: true, details },
    summary: {
      scheme: {
        idGradeScheme: 1,
        assistantPercentage: 20,
        details: details.map((detail) => ({
          idGradeSchemeDetail: detail.idGradeSchemeDetail,
          name: detail.gradeItem.name,
          percentage: detail.percentage,
          maximumScore: weightedScore(100, detail.percentage, 0.2)!,
        })),
      },
      students: [
        {
          idEnrollment: 10,
          details: [
            { idGradeSchemeDetail: 1, rawScore: 37.5, weightedScore: 4.5 },
            { idGradeSchemeDetail: 2, rawScore: 90, weightedScore: 5.4 },
            { idGradeSchemeDetail: 3, rawScore: null, weightedScore: null },
          ],
          totalRaw: 49.5,
          assistantContribution: 9.9,
        },
      ],
    },
    grades: [80, 70, null, 0].flatMap((score, index) =>
      score === null
        ? []
        : [
            {
              idGrade: index + 1,
              isActive: true,
              score,
              enrollment,
              activity: activities[index],
              gradeSchemeDetail: { ...details[0], gradeScheme: { idGradeScheme: 1, name: 'Auxiliar' } },
            },
          ],
    ),
    attendance: { totalSessions: 10, presentSessions: 9, excusedSessions: 0, absentSessions: 1, percentage: 90 },
    canEdit: true,
    canViewAttendance: true,
  };
}

function markup(props = fixture(), mode: 'weighted' | 'raw' = 'weighted') {
  vi.mocked(ReactRuntime.useState).mockImplementation(((initial: unknown) =>
    actual.useState(initial === 'weighted' ? mode : initial)) as typeof ReactRuntime.useState);

  return renderToStaticMarkup(<StudentAcademicRecord {...props} />)
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, '');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ReactRuntime.useState).mockImplementation(actual.useState);
});

function findNodes(tree: ReactRuntime.ReactNode, type: unknown): ReactRuntime.ReactElement<Record<string, unknown>>[] {
  const result: ReactRuntime.ReactElement<Record<string, unknown>>[] = [];

  ReactRuntime.Children.forEach(tree, (child) => {
    if (!ReactRuntime.isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === type) result.push(child);

    if (child.type === AcademicCriteria) {
      result.push(...findNodes(AcademicCriteria(child.props as unknown as AcademicCriteriaProps), type));
    }

    result.push(...findNodes(child.props.children as ReactRuntime.ReactNode, type));
  });

  return result;
}

describe('Ficha académica individual', () => {
  it('shows identity and course context', () => {
    const html = markup();

    for (const value of ['Juan Pérez', '1234567', '2019001', 'SIS-414', 'Tecnologías emergentes'])
      expect(html).toContain(value);
  });
  it('renders dynamic criteria and activities without editable inputs', () => {
    const html = markup();

    for (const value of ['Proyectos dinámicos', 'Evaluación oral', 'Entrega 1', 'Entrega 4'])
      expect(html).toContain(value);
    expect(renderToStaticMarkup(<StudentAcademicRecord {...fixture()} />)).not.toContain('<input');
  });
  it('distinguishes an actual zero from a missing Grade', () => {
    expect(markup()).toMatch(/Entrega 3[\s\S]*?--/);
    expect(markup()).toMatch(/Entrega 4[\s\S]*?0\.0/);
  });
  it('shows backend weighted results and assistant maximum of 20', () => {
    expect(markup()).toContain('4.5 / 12');
    expect(markup()).toContain('9.9 / 20');
    expect(markup()).toContain('49.5 / 100');
  });
  it('shows backend raw results when toggled', () => {
    expect(markup(fixture(), 'raw')).toContain('37.5 / 100');
  });
  it('does not recompute authoritative backend results in the view', () => {
    const props = fixture();

    props.summary.students[0].details[0].rawScore = 61.2;
    expect(markup(props, 'raw')).toContain('61.2 / 100');
  });
  it('keeps attendance separate from activities', () => {
    const html = markup();

    expect(html).toContain('9Presentes');
    expect(html).toContain('1Ausencia');
    expect(html).toContain('10Sesiones');
    expect(html).not.toContain('NO ES ACTIVIDAD');
    expect(html).toContain('Ver asistencia');
  });
  it('handles a direct criterion with no activities and no Grade', () => {
    expect(markup()).toContain('Criterio directo · Sin actividades');
    expect(markup()).toContain('Sin calificación directa.');
  });
  it('keeps missing activity Grades as -- even when calculation yields zero', () => {
    const props = fixture();

    props.grades = [];
    props.summary.students[0].details[0] = { idGradeSchemeDetail: 1, rawScore: 0, weightedScore: 0 };
    expect(markup(props)).toMatch(/Entrega 1[\s\S]*?--/);
    expect(markup(props)).toContain('0.0 / 12');
  });
  it('shows no-scheme, no-criteria and no-attendance states', () => {
    const props = fixture();

    expect(markup({ ...props, scheme: null })).toContain('Todavía no se ha configurado');
    expect(markup({ ...props, scheme: { ...props.scheme!, details: [] } })).toContain('todavía no tiene criterios');
    expect(
      markup({
        ...props,
        attendance: { totalSessions: 0, presentSessions: 0, excusedSessions: 0, absentSessions: 0, percentage: 0 },
      }),
    ).toContain('Sin sesiones');
  });
  it('shows an attendance error without presenting it as no sessions', () => {
    expect(markup({ ...fixture(), attendance: null, attendanceError: 'Asistencia no disponible' })).toContain(
      'Asistencia no disponible',
    );
  });
  it('links management to Matrix only with edit permission', () => {
    expect(renderToStaticMarkup(<StudentAcademicRecord {...fixture()} />)).toContain(
      'href="/dashboard/enrollments/7/grades"',
    );
    expect(markup({ ...fixture(), canEdit: false, onManageDirect: vi.fn() })).not.toContain('Gestionar');
    expect(markup({ ...fixture(), canViewAttendance: false })).not.toContain('Ver asistencia');
  });
  it('matches Matrix and shared summary calculations including missing grades', () => {
    const props = fixture();
    const raw = studentCriterionResult(10, [1, 2, 3, 4], { '10:1': 80, '10:2': 70, '10:4': 0 }, {});

    expect(raw).toBe(averageScores([80, 70, null, 0]));
    expect(raw).toBe(props.summary.students[0].details[0].rawScore);
    expect(weightedScore(raw, 60, 0.2)).toBe(props.summary.students[0].details[0].weightedScore);
    expect(studentCriterionResult(10, [1, 2, 3], { '10:1': 80, '10:2': 70 }, {})).toBe(50);
  });
  it('integrates the representation selector into the performance section', () => {
    vi.mocked(ReactRuntime.useState).mockReturnValue(['weighted', vi.fn()]);
    const tree = StudentAcademicRecord(fixture());
    const performance = findNodes(tree, Card).find((node) => node.props['aria-label'] === 'Rendimiento');

    expect(performance).toBeDefined();
    expect(findNodes(performance, GradeViewToggle)).toHaveLength(1);
    expect(findNodes(tree, GradeViewToggle)).toHaveLength(1);
  });
  it('puts the criterion result before its activities without a duplicate footer', () => {
    const html = renderToStaticMarkup(<StudentAcademicRecord {...fixture()} />);

    expect(html.indexOf('Resultado de Proyectos dinámicos')).toBeLessThan(html.indexOf('Entrega 1'));
    expect(html.match(/Resultado de Proyectos dinámicos/g)).toHaveLength(1);
  });
  it('allows adaptive columns and natural card heights', () => {
    vi.mocked(ReactRuntime.useState).mockReturnValue(['weighted', vi.fn()]);
    const tree = StudentAcademicRecord(fixture());
    const grid = findNodes(tree, Box).find((node) => node.props['aria-label'] === 'Criterios de evaluación');

    expect(grid?.props.sx).toMatchObject({
      alignItems: 'start',
      gridTemplateColumns: {
        xs: 'minmax(0, 1fr)',
        sm: 'repeat(2, minmax(0, 1fr))',
        lg: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
      },
    });
    for (const card of findNodes(grid, Card)) expect(card.props.sx).not.toHaveProperty('height');
  });
  it('keeps a zero-weight criterion visible with its provided result', () => {
    const props = fixture();

    props.scheme!.details[0].percentage = 0;
    props.summary.scheme!.details[0].maximumScore = 0;
    props.summary.students[0].details[0].weightedScore = 0;
    expect(markup(props)).toContain('Proyectos dinámicos');
    expect(markup(props)).toContain('0%');
    expect(markup(props)).toContain('0.0 / 0');
  });
  it.each(['light', 'dark'] as const)('renders the same information in %s mode', (mode) => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <StudentAcademicRecord {...fixture()} />
      </ThemeProvider>,
    );

    expect(html).toContain('Juan');
    expect(html).toContain('Resultado de Proyectos dinámicos');
    expect(html).toContain('Ver asistencia');
    expect(html).not.toContain('<input');
  });
  it.each(['light', 'dark'] as const)('uses theme colors for the segmented control in %s mode', (mode) => {
    vi.mocked(ReactRuntime.useState).mockReturnValue(['weighted', vi.fn()]);
    const tree = StudentAcademicRecord(fixture());
    const toggle = findNodes(tree, GradeViewToggle)[0];
    const theme = createTheme({ palette: { mode } });
    const styles = (toggle.props.sx as (currentTheme: typeof theme) => Record<string, unknown>)(theme);

    expect(styles['& .MuiToggleButton-root.Mui-selected']).toMatchObject({
      bgcolor: 'primary.main',
      color: 'primary.contrastText',
    });
    expect(styles['& .MuiToggleButton-root.Mui-focusVisible']).toMatchObject({
      outline: `2px solid ${theme.palette.primary.main}`,
    });
  });
  it('toggle changes only local representation with no grade writes', () => {
    const setMode = vi.fn();

    vi.mocked(ReactRuntime.useState).mockReturnValue(['weighted', setMode]);
    const tree = StudentAcademicRecord(fixture());
    const nodes: ReactRuntime.ReactElement<Record<string, unknown>>[] = [];

    const visit = (node: ReactRuntime.ReactNode) =>
      ReactRuntime.Children.forEach(node, (child) => {
        if (!ReactRuntime.isValidElement<Record<string, unknown>>(child)) return;
        if (child.type === GradeViewToggle) nodes.push(child);
        visit(child.props.children as ReactRuntime.ReactNode);
      });

    visit(tree);
    (nodes[0].props.onChange as (mode: string) => void)('raw');
    expect(setMode).toHaveBeenCalledWith('raw');
    expect(createGrade).not.toHaveBeenCalled();
    expect(updateGrade).not.toHaveBeenCalled();
    expect(deleteGrade).not.toHaveBeenCalled();
  });
});
