import { attendanceImportDateError } from './attendance-import-period';

describe('Período académico de importación de asistencia', () => {
  const semester = {
    startDate: new Date('2026-08-05T04:00:00Z'),
    endDate: new Date('2026-12-01T03:59:59Z'),
  };
  it.each(['2026-08-05', '2026-09-15', '2026-11-30'])(
    'acepta el día calendario %s sin depender de hoy ni desplazarlo por UTC',
    (date) => {
      expect(attendanceImportDateError(date, semester)).toBeNull();
    },
  );
  it.each(['2026-08-04', '2026-12-01', '2025-09-15', '2027-09-15'])(
    'rechaza %s fuera del semestre',
    (date) => {
      expect(attendanceImportDateError(date, semester)).toMatch(/fuera del período/);
    },
  );
  it.each(['2026-02-30', '2026-13-01', '15/09/2026', '0000-09-15', 'invalid'])(
    'rechaza una fecha inválida %s',
    (date) => {
      expect(attendanceImportDateError(date, semester)).toMatch(/fecha válida/);
    },
  );
  it.each([
    undefined,
    null,
    { ...semester, startDate: new Date(NaN) },
    { ...semester, endDate: new Date('2026-01-01Z') },
  ])('no inventa límites ausentes o inconsistentes', (period) => {
    expect(attendanceImportDateError('2026-09-15', period)).toMatch(/fechas oficiales/);
  });
});
