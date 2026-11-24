import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTheme, ThemeProvider } from '@mui/material/styles';

import { AttendanceStatus } from '@/enums/attendanceStatus';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { AttendanceSheet } from './AttendanceSheet';
import { AttendanceSessionToolbar } from './AttendanceSessionToolbar';

const student = {
  idEnrollment: 1,
  user: { name: 'Ana', lastname: 'Pérez', ci: '123', ru: '456' },
} as IEnrollmentStudent;

const props = {
  students: [student],
  totalStudents: 1,
  attendance: { 1: AttendanceStatus.ABSENT },
  loading: false,
  saving: false,
  search: '',
  presentCount: 0,
  excusedCount: 0,
  absentCount: 1,
  hasChanges: false,
  modifiedStudentIds: [],
  permissionWeight: 0.5,
  permissionWeightLoading: false,
  permissionWeightError: false,
  onSearchChange: () => {},
  onChangeAttendance: () => {},
  onMarkAllPresent: () => {},
  onMarkAllAbsent: () => {},
  onCancelChanges: () => {},
  onSave: () => {},
};

function html(extra: Partial<Parameters<typeof AttendanceSheet>[0]> = {}) {
  return renderToStaticMarkup(<AttendanceSheet {...props} {...extra} />);
}

describe('Attendance sheet UX', () => {
  it('keeps refresh disabled while attendance changes are pending', () => {
    const result = html({ hasChanges: true, onRefresh: () => {} });

    expect(result).toMatch(/<button(?=[^>]*disabled)[^>]*>(?:(?!<\/button>)[\s\S])*Actualizar<\/button>/);
    expect(result).toContain('Guarda o cancela las asistencias pendientes');
  });
  it('shows pending instead of implicit absence while GEO is not consolidated', () => {
    const result = html({ pending: true, pendingStudentIds: [1], readOnly: true });

    expect(result).toContain('Pendientes');
    expect(result).toContain('Pendiente');
    expect(result).not.toContain('se consideran ausentes');
    expect(result).toMatch(/<button(?=[^>]*aria-label="Guardar asistencia")(?=[^>]*disabled)[^>]*>/);
  });
  it('protects GEO marks and disables mark-all with an explanation', () => {
    const result = html({ markAllDisabled: true, lockedStudentIds: [1] });

    expect(result).toContain('No se puede usar Marcar todos');
    expect(result).toMatch(/<button(?=[^>]*aria-label="Marcar a Ana Pérez como presente")(?=[^>]*disabled)[^>]*>/);
  });
  it.each(['light', 'dark'] as const)('renders the summary and read-only permission value in %s mode', (mode) => {
    const result = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <AttendanceSheet {...props} />
      </ThemeProvider>,
    );

    expect(result).toContain('Permiso = 50% de una asistencia');
    expect(result).toContain('Estudiantes');
    expect(result).toContain('Presentes');
    expect(result).toContain('Permisos');
    expect(result).toContain('Ausentes');
    expect(result).not.toMatch(/Marcar todos[^<]*permiso/i);
  });
  it('disables save with no changes and reports modified students explicitly', () => {
    expect(html()).toMatch(/<button(?=[^>]*aria-label="Guardar asistencia")(?=[^>]*disabled)[^>]*>/);
    const result = html({ hasChanges: true, modifiedStudentIds: [1] });

    expect(result).toContain('1 estudiante modificado');
    expect(result).toContain('Modificado · sin guardar');
  });
  it('distinguishes an empty roster from an empty search result', () => {
    expect(html({ students: [], totalStudents: 0 })).toContain('No hay estudiantes matriculados en esta materia.');
    expect(html({ students: [], totalStudents: 1 })).toContain('No se encontraron estudiantes para esta búsqueda.');
  });
  it('does not invent a permission value when the scheme cannot be loaded', () => {
    const result = html({ permissionWeight: null, permissionWeightError: true });

    expect(result).toContain('Valor del permiso no disponible');
    expect(result).not.toContain('Permiso = 1');
  });
  it('keeps the session date and editing feedback visible', () => {
    const result = renderToStaticMarkup(
      <AttendanceSessionToolbar
        selectedDate='2026-09-28'
        selectedSessionId={1}
        session={{ date: '2026-09-28' }}
        hasChanges={true}
        saving={false}
        onDateChange={() => {}}
        onCreateSession={() => {}}
      />,
    );

    expect(result).toContain('Editando sesión #1 del 28/09/2026');
    expect(result).toContain('Cambios sin guardar');
    expect(result).not.toContain('Sesión guardada');
  });
});

describe('combined unified sheet', () => {
  it('keeps pending and explicit absent counts separate, without bulk or physical delete', () => {
    const result = html({
      combined: true,
      pending: true,
      pendingCount: 1,
      pendingStudentIds: [1],
      absentCount: 0,
      onContingency: () => {},
    });

    expect(result).toContain('Pendiente');
    expect(result).toContain('Ausentes');
    expect(result).toContain('Registrar contingencia');
    expect(result).not.toContain('Marcar todos');
    expect(result).not.toContain('Guardar asistencia');
    expect(result).not.toContain('Eliminar');
  });
  it.each([AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED, AttendanceStatus.ABSENT])(
    'preserves a manual %s record and reason',
    (status) => {
      const result = html({
        combined: true,
        records: [
          {
            idAttendance: 1,
            enrollment: student,
            status,
            registrationMethod: 'MANUAL',
            observation: 'Incidencia verificada en aula',
          },
        ],
        onContingency: () => {},
      });

      expect(result).toContain('Manual');
      expect(result).toContain('Incidencia verificada en aula');
      expect(result).toContain('Corregir contingencia');
      if (status === AttendanceStatus.ABSENT) expect(result).toContain('Ausente (explícito)');
    },
  );
  it('distinguishes closed implicit absence and protects combined evidence', () => {
    expect(html({ combined: true })).toContain('Ausente (implícito)');

    const result = html({
      combined: true,
      records: [
        {
          idAttendance: 1,
          enrollment: student,
          status: AttendanceStatus.PRESENT,
          registrationMethod: 'GEOLOCATION_QR',
        },
      ],
      onContingency: () => {},
    });

    expect(result).toContain('QR + ubicación');
    expect(result).not.toContain('Corregir contingencia');
  });
});

it.each(['DRAFT', 'SCHEDULED', 'CANCELLED'] as const)(
  'shows no mark, rather than implicit absence, in combined %s',
  (sessionState) => {
    const result = html({ combined: true, sessionState, pending: true, pendingStudentIds: [1], readOnly: true });

    expect(result).toContain('Sin marca');
    expect(result).not.toContain('Ausente (implícito)');
  },
);
