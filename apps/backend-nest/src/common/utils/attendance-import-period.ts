import { attendanceAcademicDate } from './attendance-session-policy';

/** Calendar dates are compared in the academic timezone, never the machine timezone. */
export function attendanceImportDateError(
  date: string,
  semester: { startDate: Date; endDate: Date } | null | undefined,
): string | null {
  const instant = new Date(`${date}T00:00:00-04:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    date.startsWith('0000-') ||
    !Number.isFinite(instant.getTime()) ||
    attendanceAcademicDate(instant) !== date
  )
    return 'Ingresa una fecha válida en formato dd/mm/aaaa';
  const start = semester?.startDate;
  const end = semester?.endDate;
  if (
    !(start instanceof Date) ||
    !(end instanceof Date) ||
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    start > end
  )
    return 'El semestre no tiene un período académico válido. Solicita revisar sus fechas oficiales';
  if (date < attendanceAcademicDate(start) || date > attendanceAcademicDate(end))
    return 'La fecha está fuera del período académico del semestre seleccionado';
  return null;
}
