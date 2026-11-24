import { attendanceInstant, attendanceLocalTime } from './attendance-geolocation';

export const attendanceToday = (now = new Date()) => attendanceLocalTime(now.toISOString()).slice(0, 10);

export const attendanceDuration = (start?: string | null, end?: string | null) =>
  start && end ? String((Date.parse(end) - Date.parse(start)) / 60000) : '';

export function attendanceDurationMinutes(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const minutes = Number(value);

  return Number.isSafeInteger(minutes) && minutes >= 1 ? minutes : null;
}

/** The API accepts four-digit ISO years. Reject overflow rather than clamp it. */
export function attendanceEnd(start: string, duration: string): string | null {
  const instant = attendanceInstant(start);
  const minutes = attendanceDurationMinutes(duration);

  if (!instant || minutes === null) return null;
  const end = new Date(Date.parse(instant) + minutes * 60000);

  return Number.isFinite(end.getTime()) && end.getUTCFullYear() <= 9999 ? end.toISOString() : null;
}

export const attendanceDurationHelp = 'Tiempo durante el cual los estudiantes podrán registrar su asistencia.';
export const attendanceDurationError =
  'Indica una duración entera de al menos 1 minuto, dentro del rango de fechas admitido y del semestre académico.';

// Client-side range feedback only; open-now still sends minutes and uses server time.
export function attendanceOpeningDuration(value: string): number | null {
  return attendanceEnd(attendanceLocalTime(new Date().toISOString()), value) ? attendanceDurationMinutes(value) : null;
}
