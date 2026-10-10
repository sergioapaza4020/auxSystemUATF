import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTheme, ThemeProvider } from '@mui/material/styles';

import { AttendanceSidebar } from './AttendanceSidebar';

const props: Parameters<typeof AttendanceSidebar>[0] = {
  sessions: Array.from({ length: 7 }, (_, index) => ({
    idAttendanceSession: index + 1,
    date: `2026-10-${String(10 - index).padStart(2, '0')}`,
    presentCount: 5,
    excusedCount: 1,
    absentCount: 3,
    totalStudents: 9,
    percentage: 61.123,
  })),
  selectedSessionId: 1,
  present: 9,
  excused: 0,
  absent: 0,
  total: 9,
  hasChanges: true,
  loading: false,
  permissionWeight: 0.625,
  configLoading: false,
  configError: false,
  canEditConfig: true,
  disabled: false,
  onOpenSession: () => {},
  onViewHistory: () => {},
  onEditConfig: () => {},
};

describe('Attendance sidebar', () => {
  it.each(['light', 'dark'] as const)('uses saved server percentages and caps quick history in %s mode', (mode) => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={createTheme({ palette: { mode } })}>
        <AttendanceSidebar {...props} />
      </ThemeProvider>,
    );

    expect(html).toContain('61.1%');
    expect(html).not.toContain('100.0%');
    expect(html).toContain('Guarda para actualizar el porcentaje.');
    expect(html).toContain('62.5%');
    expect(html).toContain('Editar configuración');
    expect(html.match(/aria-label="Abrir sesión del/g)).toHaveLength(5);
  });
  it('hides editing without permission and does not invent missing configuration', () => {
    const html = renderToStaticMarkup(<AttendanceSidebar {...props} permissionWeight={null} canEditConfig={false} />);

    expect(html).not.toContain('Editar configuración');
    expect(html).toContain('Configura el criterio de asistencia');
    expect(html).not.toContain('62.5%');
  });
});
