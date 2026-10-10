import { createTheme, ThemeProvider } from '@mui/material/styles';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { attendanceStatusConfig } from '@/utils/attendance-status';

import { AttendanceStatus } from '@/enums/attendanceStatus';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { AttendanceStudentRow } from './AttendanceStudentRow';

describe('AttendanceStudentRow', () => {
  it.each(['light', 'dark'] as const)('uses state theme colors and inherited icon color in %s mode', (mode) => {
    const theme = createTheme({ palette: { mode } });
    const student = { idEnrollment: 1, user: { name: 'Ana', lastname: 'Perez' } } as IEnrollmentStudent;

    for (const status of [AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED, AttendanceStatus.ABSENT]) {
      const html = renderToStaticMarkup(
        <ThemeProvider theme={theme}>
          <AttendanceStudentRow number={1} student={student} status={status} onChange={() => {}} />
        </ThemeProvider>,
      );

      const color = theme.palette[attendanceStatusConfig[status].color].main;

      expect(html).toContain(`.Mui-selected{color:${color}`);
      expect(html).toMatch(/Mui-selected \.MuiSvgIcon-root\{color:inherit/);
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    }
  });
  it.each([AttendanceStatus.PRESENT, AttendanceStatus.EXCUSED, AttendanceStatus.ABSENT])(
    'renders exactly one selected state for %s',
    (status) => {
      const student = {
        idEnrollment: 1,
        user: { name: 'Ana', lastname: 'Perez', username: 'ana', ci: '123', ru: '456' },
      } as IEnrollmentStudent;

      const html = renderToStaticMarkup(
        <AttendanceStudentRow number={1} student={student} status={status} onChange={() => {}} />,
      );

      expect(html).toContain('Presente');
      expect(html).toContain('Permiso');
      expect(html).toContain('Ausente');
      expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
      expect(html).toContain(`value="${status}"`);
      expect(html).toContain('Marcar a Ana Perez como presente');
      expect(html).toContain('Marcar a Ana Perez con permiso');
      expect(html).toContain('Marcar a Ana Perez como ausente');
    },
  );
  it.each([AttendanceStatus.PRESENT, AttendanceStatus.ABSENT])(
    'hides observation editing for %s even with a stale observation',
    (status) => {
      const student = { idEnrollment: 1, user: { name: 'Ana', lastname: 'Perez' } } as IEnrollmentStudent;

      const html = renderToStaticMarkup(
        <AttendanceStudentRow
          number={1}
          student={student}
          status={status}
          observation='Anterior'
          onChange={() => {}}
          onEditObservation={() => {}}
        />,
      );

      expect(html).not.toContain('Editar observación');
      expect(html).not.toContain('Agregar observación');
    },
  );
  it('shows optional permission observation without marking a saved row dirty', () => {
    const student = { idEnrollment: 1, user: { name: 'Ana', lastname: 'Perez' } } as IEnrollmentStudent;

    const saved = renderToStaticMarkup(
      <AttendanceStudentRow
        number={1}
        student={student}
        status={AttendanceStatus.EXCUSED}
        observation='Cita médica'
        onChange={() => {}}
        onEditObservation={() => {}}
      />,
    );

    expect(saved).toContain('Editar observación de Ana Perez');
    expect(saved).toMatch(/class="[^"]*MuiBadge-invisible/);
    expect(saved).not.toContain('Modificado · sin guardar');

    const modified = renderToStaticMarkup(
      <AttendanceStudentRow
        number={1}
        student={student}
        status={AttendanceStatus.PRESENT}
        modified
        onChange={() => {}}
      />,
    );

    expect(modified).toContain('Modificado · sin guardar');
    expect(modified).not.toMatch(/class="[^\"]*MuiBadge-invisible/);
  });
});
