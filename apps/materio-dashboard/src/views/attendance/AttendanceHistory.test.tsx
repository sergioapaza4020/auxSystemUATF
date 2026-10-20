import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import { AttendanceHistory } from './AttendanceHistory';

describe('AttendanceHistory', () => {
  it('offers the first session action in the empty state', () => {
    const html = renderToStaticMarkup(
      <AttendanceHistory
        meta={{ page: 1, limit: 5, total: 0, totalPages: 0 }}
        onPageChange={() => {}}
        onLimitChange={() => {}}
        sessions={[]}
        loading={false}
        selectedSessionId={null}
        onSelectSession={() => {}}
        onCreateSession={() => {}}
      />,
    );

    expect(html).toContain('No hay sesiones de asistencia registradas.');
    expect(html).toContain('Crear primera sesión');
  });
  it('displays permissions and the percentage supplied by the backend', () => {
    const html = renderToStaticMarkup(
      <AttendanceHistory
        meta={{ page: 1, limit: 5, total: 1, totalPages: 1 }}
        onPageChange={() => {}}
        onLimitChange={() => {}}
        sessions={[
          {
            idAttendanceSession: 1,
            date: '2026-10-10',
            presentCount: 3,
            excusedCount: 1,
            absentCount: 5,
            totalStudents: 9,
            percentage: 38.888888,
          },
        ]}
        loading={false}
        selectedSessionId={null}
        onSelectSession={() => {}}
      />,
    );

    expect(html).toContain('Permisos');
    expect(html).toContain('Abrir sesión del 10/10/2026');
    expect(html).toContain('Más acciones de la sesión del 10/10/2026');
    expect(html).toContain('38.9');
    expect(html).not.toContain('37.5%');
  });
});
