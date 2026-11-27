import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { IMyEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { UserRole } from '@/enums/userRole';

import { renderMySubjectsMenuItems } from './MySubjectsMenu';

vi.mock('@mui/material/Box', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@mui/material/CircularProgress', () => ({
  default: (props: { 'aria-label'?: string }) => <span aria-label={props['aria-label']} />,
}));
vi.mock('@mui/material/Tooltip', () => ({
  default: ({ children, title }: { children: ReactNode; title: string }) => <span title={title}>{children}</span>,
}));
vi.mock('@mui/material/Typography', () => ({
  default: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@mui/material/styles', () => ({ useTheme: () => ({}) }));
vi.mock('@menu/vertical-menu', () => ({
  MenuItem: ({
    children,
    href,
    disabled,
    'aria-label': ariaLabel,
    role,
  }: {
    children: ReactNode;
    href?: string;
    disabled?: boolean;
    'aria-label'?: string;
    role?: string;
  }) =>
    disabled ? (
      <div>{children}</div>
    ) : (
      <a href={href} aria-label={ariaLabel} role={role}>
        {children}
      </a>
    ),
}));

const assignment = (id: number, role: UserRole, name: string, group: number): IMyEnrollment =>
  ({
    idEnrollment: id,
    role,
    isActive: true,
    course: { idCourse: id, isActive: true, code: `SIS${id}`, name, group },
    semester: { idSemester: 1, isActive: true, year: 2026, period: 'I', startDate: '', endDate: '' },
  }) as IMyEnrollment;

describe('Mis materias menu entries', () => {
  it('links each assignment by enrollment ID and displays its academic role and group', () => {
    const html = renderToStaticMarkup(
      <>
        {renderMySubjectsMenuItems(
          {
            loading: false,
            error: false,
            enrollments: [
              assignment(11, UserRole.ASSISTANT, 'Programacion I', 1),
              assignment(12, UserRole.STUDENT, 'Bases de Datos', 2),
            ],
          },
          vi.fn(),
        )}
      </>,
    );

    expect(html).toContain('href="/dashboard/enrollments/11"');
    expect(html).toContain('Programacion I');
    expect(html).toContain('Auxiliar - Grupo 1');
    expect(html).toContain('href="/dashboard/enrollments/12"');
    expect(html).toContain('Estudiante - Grupo 2');
  });

  it('keeps same-name assignments distinct by enrollment ID', () => {
    const html = renderToStaticMarkup(
      <>
        {renderMySubjectsMenuItems(
          {
            loading: false,
            error: false,
            enrollments: [
              assignment(21, UserRole.ASSISTANT, 'Sistemas', 1),
              assignment(22, UserRole.STUDENT, 'Sistemas', 1),
            ],
          },
          vi.fn(),
        )}
      </>,
    );

    expect(html.match(/Sistemas/g)).toHaveLength(6);
    expect(html).toContain('href="/dashboard/enrollments/21"');
    expect(html).toContain('href="/dashboard/enrollments/22"');
    expect(html).toContain('Auxiliar - Grupo 1');
    expect(html).toContain('Estudiante - Grupo 1');
  });

  it('renders loading, empty, and retryable error states', () => {
    const retry = vi.fn();

    const loading = renderToStaticMarkup(
      <>{renderMySubjectsMenuItems({ loading: true, error: false, enrollments: [] }, retry)}</>,
    );

    const empty = renderToStaticMarkup(
      <>{renderMySubjectsMenuItems({ loading: false, error: false, enrollments: [] }, retry)}</>,
    );

    const error = renderToStaticMarkup(
      <>{renderMySubjectsMenuItems({ loading: false, error: true, enrollments: [] }, retry)}</>,
    );

    expect(loading).toContain('Cargando materias...');
    expect(empty).toContain('No tienes materias asignadas.');
    expect(error).toContain('Reintentar');
    expect(error).toContain('role="button"');
  });

  it('preserves the complete long course name for its tooltip and link label', () => {
    const name = 'Fundamentos avanzados de arquitectura de sistemas distribuidos';

    const html = renderToStaticMarkup(
      <>
        {renderMySubjectsMenuItems(
          { loading: false, error: false, enrollments: [assignment(30, UserRole.STUDENT, name, 4)] },
          vi.fn(),
        )}
      </>,
    );

    expect(html).toContain(`title="${name}"`);
    expect(html).toContain(name);
    expect(html).toContain('href="/dashboard/enrollments/30"');
  });
});
