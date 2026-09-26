// datetime-local fields preserve the user's timezone; HTTP always sends an explicit ISO instant.
export function toLocalDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function toSemesterDate(value: string, original?: string): string {
  if (original && toLocalDateTime(original) === value) return original;

  return new Date(value).toISOString();
}

export function semesterDateError(start: string, end: string): string {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return 'Completa ambas fechas.';
  if (startTime > endTime) return 'La fecha de fin debe ser igual o posterior a la fecha de inicio.';

  return '';
}

export function formatSemesterDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : date.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}
