import * as React from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Button, TextField } from '@mui/material';

import { PaginationTable } from '@/components/table';
import { GradeViewToggle } from './GradeViewToggle';

import { EnrollmentStudentsCard } from './EnrollmentStudentsCard';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { IStudentGradeSummary } from '@/interfaces/enrollments/student-grade-summary.interface';

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return { ...actual, useState: vi.fn(actual.useState), useMemo: vi.fn(actual.useMemo) };
});
const actualReact = await vi.importActual<typeof React>('react');

const students = Array.from({ length: 12 }, (_, index) => ({
  idEnrollment: index + 1,
  user: { name: `Alumno${index + 1}`, lastname: 'Apellido', ci: `CI${index + 1}`, ru: `RU${index + 1}` },
})) as IEnrollmentStudent[];

const summary: IStudentGradeSummary = {
  scheme: {
    idGradeScheme: 1,
    assistantPercentage: 20,
    details: [{ idGradeSchemeDetail: 4, name: 'Criterio configurable', percentage: 100, maximumScore: 20 }],
  },
  students: students.map((student) => ({
    idEnrollment: student.idEnrollment,
    details: [{ idGradeSchemeDetail: 4, rawScore: 85, weightedScore: 17 }],
    totalRaw: 85,
    assistantContribution: 17,
  })),
};

type Props = Parameters<typeof EnrollmentStudentsCard>[0];

function harness(extra: Partial<Props> = {}) {
  const state: unknown[] = [];

  const props: Props = {
    students,
    summary,
    loading: false,
    onSelectStudent: vi.fn(),
    onManageAttendance: vi.fn(),
    onImportStudents: vi.fn(),
    ...extra,
  };

  function render() {
    let slot = 0;

    const useState = vi.mocked(React.useState).mockImplementation(((initial: unknown) => {
      const index = slot++;

      if (!(index in state)) state[index] = initial;

      return [
        state[index],
        (value: unknown) => {
          state[index] = typeof value === 'function' ? value(state[index]) : value;
        },
      ];
    }) as typeof React.useState);

    const useMemo = vi.mocked(React.useMemo).mockImplementation((factory) => factory());
    let tree: React.ReactElement;

    try {
      tree = EnrollmentStudentsCard(props);
    } finally {
      useState.mockImplementation(actualReact.useState);
      useMemo.mockImplementation(actualReact.useMemo);
    }

    return { tree, html: renderToStaticMarkup(tree) };
  }

  return { render, props };
}

function find(
  tree: React.ReactNode,
  predicate: (element: React.ReactElement<Record<string, unknown>>) => boolean,
): React.ReactElement<Record<string, unknown>>[] {
  const matches: React.ReactElement<Record<string, unknown>>[] = [];

  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (predicate(child)) matches.push(child);
    matches.push(...find(child.props.children as React.ReactNode, predicate));
    if (React.isValidElement(child.props.action)) matches.push(...find(child.props.action, predicate));
  });

  return matches;
}

describe('Student grade table', () => {
  it('generates columns from the scheme and preserves identity and actions', () => {
    const { html } = harness().render();

    for (const text of [
      'Criterio configurable',
      '100%',
      'CI1',
      'RU1',
      'Importar estudiantes',
      'Tomar asistencia',
      'Ver',
    ])
      expect(html).toContain(text);
    expect(html).not.toContain('Prácticas');
    expect(html).toContain('overflow-x:auto');
  });
  it('shows weighted contribution and assistant maximum by default', () => {
    const { html } = harness().render();

    expect(html).toContain('17.0');
    expect(html).toContain(' / 20');
  });
  it('toggles to 100% without modifying source data or making HTTP calls', () => {
    const snapshot = JSON.stringify(summary);
    const h = harness();
    const toggle = find(h.render().tree, (element) => element.type === GradeViewToggle)[0];

    (toggle.props.onChange as (value: string) => void)('raw');
    const { html } = h.render();

    expect(html).toContain('85.0');
    expect(html).toContain(' / 100');
    expect(JSON.stringify(summary)).toBe(snapshot);
  });
  it('distinguishes missing data from a zero score', () => {
    const missing = {
      ...summary,
      students: [
        {
          ...summary.students[0],
          totalRaw: null,
          assistantContribution: null,
          details: [{ idGradeSchemeDetail: 4, rawScore: null, weightedScore: null }],
        },
      ],
    };

    expect(harness({ summary: missing }).render().html).toContain('--');
    const zero = { ...missing, students: [{ ...missing.students[0], totalRaw: 0, assistantContribution: 0 }] };

    expect(harness({ summary: zero }).render().html).toContain('0.0');
  });
  it('supports additional criteria and absence of scheme', () => {
    const extra = {
      ...summary,
      scheme: {
        ...summary.scheme!,
        details: [
          ...summary.scheme!.details,
          { idGradeSchemeDetail: 5, name: 'Otra evaluación', percentage: 0, maximumScore: 0 },
        ],
      },
    };

    expect(harness({ summary: extra }).render().html).toContain('Otra evaluación');
    expect(harness({ summary: { scheme: null, students: [] } }).render().html).toContain(
      'Todavía no existe un esquema',
    );
  });
  it('preserves student order, local pagination, search and selection', () => {
    const h = harness();
    let view = h.render();

    expect(view.html).not.toContain('Alumno11');

    const next = find(view.tree, (element) => element.type === PaginationTable)[0];

    (next.props.onPageChange as (event: null, page: number) => void)(null, 1);
    view = h.render();
    expect(view.html).toContain('Alumno11');
    expect(view.html).toContain('Alumno12');
    expect(view.html).not.toContain('>Alumno1 ');
    const search = find(view.tree, (element) => element.type === TextField)[0];

    (search.props.onChange as (event: { target: { value: string } }) => void)({ target: { value: 'CI12' } });
    view = h.render();
    expect(view.html).toContain('Alumno12');
    expect(view.html).not.toContain('Alumno11');
    const see = find(view.tree, (element) => element.type === Button && element.props.children === 'Ver')[0];

    (see.props.onClick as (event: { stopPropagation: () => void }) => void)({ stopPropagation: vi.fn() });
    expect(h.props.onSelectStudent).toHaveBeenCalledWith(students[11]);
  });
  it('shows errors, retry and loading states without breaking existing actions', () => {
    const retry = vi.fn();
    const h = harness({ summaryError: 'Error de carga', summary: null, onRetrySummary: retry });
    const view = h.render();

    expect(view.html).toContain('Error de carga');
    const button = find(view.tree, (element) => element.type === Button && element.props.children === 'Reintentar')[0];

    (button.props.onClick as () => void)();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(harness({ summaryLoading: true }).render().html).toContain('MuiSkeleton');
  });
});

it('renders only the server page and uses meta.total instead of slicing/filtering it locally', () => {
  const changeQuery = vi.fn();

  const h = harness({
    students: students.slice(10),
    pagination: {
      query: { page: 2, limit: 10, search: 'server search' },
      meta: { page: 2, limit: 10, total: 42, totalPages: 5 },
      changeQuery,
    },
  });

  const view = h.render();

  expect(view.html).toContain('Alumno11');
  const pagination = find(view.tree, (element) => element.type === PaginationTable)[0];

  expect(pagination.props.count).toBe(42);
  expect(pagination.props.page).toBe(1);
  (pagination.props.onPageChange as (event: null, page: number) => void)(null, 2);
  expect(changeQuery).toHaveBeenCalledWith({ page: 3 });
});
