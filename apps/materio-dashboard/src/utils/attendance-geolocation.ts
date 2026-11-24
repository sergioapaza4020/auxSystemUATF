import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

import type { IAttendanceLifecycle } from '@/interfaces/attendances/attendance.interface';
import { getApiErrorMessage } from './http/getApiErrorMessage';

dayjs.extend(utc);
dayjs.extend(timezone);
export const ATTENDANCE_TIMEZONE = 'America/La_Paz';
export const attendanceStateLabels = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
  CANCELLED: 'Cancelada',
} as const;

export function attendanceLocalTime(iso?: string | null) {
  return iso ? dayjs(iso).tz(ATTENDANCE_TIMEZONE).format('YYYY-MM-DDTHH:mm') : '';
}

// Explicit Bolivia offset, independent of the browser timezone. Reject normalized invalid dates.
export function attendanceInstant(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const date = new Date(`${local}:00-04:00`);

  return Number.isFinite(date.getTime()) && attendanceLocalTime(date.toISOString()) === local
    ? date.toISOString()
    : null;
}

export const canEditAttendance = (session: IAttendanceLifecycle | null) =>
  !!session && (!isSelfRegistrationSession(session) || session.state === 'OPEN' || session.state === 'CLOSED');

export const isSelfRegistrationSession = (session?: IAttendanceLifecycle | null) =>
  session?.mode === 'GEOLOCATION' || session?.mode === 'QR' || session?.mode === 'GEOLOCATION_QR';

export const canDeleteAttendanceSession = (
  session: IAttendanceLifecycle & { presentCount: number; excusedCount: number; absentCount: number },
) =>
  !isSelfRegistrationSession(session) ||
  (session.state === 'DRAFT' && session.presentCount + session.excusedCount + session.absentCount === 0);

const messages: Record<string, string> = {
  SESSION_DATE_PAST: 'No puedes crear o configurar una sesión con una fecha anterior a hoy en Bolivia.',
  SESSION_START_PAST: 'El inicio debe ser futuro. Corrige el horario o utiliza Abrir ahora.',
  SESSION_DURATION_INVALID: 'La duración debe ser de al menos 1 minuto y usar minutos enteros.',
  SESSION_DURATION_OUT_OF_RANGE: 'La duración excede el rango de fechas admitido.',
  OUTSIDE_SEMESTER: 'El inicio y el fin deben estar dentro del semestre académico.',
  SESSION_ALREADY_ACTIVATED: 'La sesión ya fue activada. Actualiza para ver su estado.',
  SESSION_NOT_OPEN: 'La sesión no está abierta.',
  SESSION_ALREADY_CLOSED: 'La sesión ya está cerrada.',
  SESSION_CANCELLED: 'La sesión fue cancelada.',
  SESSION_CANNOT_CANCEL: 'Solo se pueden cancelar borradores y sesiones programadas sin marcas.',
  SESSION_CANNOT_DELETE: 'Esta sesión debe conservarse en el historial.',
  SESSION_HAS_ATTENDANCE: 'La sesión ya tiene registros de asistencia.',
  SESSION_HAS_GEO_EVIDENCE: 'Existen registros por geolocalización que no pueden sobrescribirse.',
  SESSION_DATE_CONFLICT: 'Ya existe una sesión para este auxiliar en esa fecha.',
  SESSION_WINDOW_EXPIRED: 'La hora de finalización ya pasó. Revisa el horario.',
  SESSION_DATE_INVALID: 'El horario debe estar dentro del semestre.',
  GEO_CONFIGURATION_INCOMPLETE: 'Completa la ubicación, radio, precisión y horario.',
  GEO_CONFIGURATION_INVALID: 'Revisa la ubicación, radio, precisión y horario.',
  SESSION_ACADEMIC_CONTEXT_INVALID: 'La matrícula del auxiliar o su contexto académico ya no están activos.',
  SESSION_USE_GEO_CONFIGURATION: 'La fecha se configura mediante el inicio de la sesión geográfica.',
};

export function getAttendanceGeoErrorMessage(error: unknown) {
  const data: unknown = axios.isAxiosError(error) ? error.response?.data : undefined;

  const code =
    data && typeof data === 'object' && 'code' in data && typeof data.code === 'string'
      ? data.code
      : getApiErrorMessage(error);

  return messages[code] ?? getApiErrorMessage(error);
}

export function assistantLocationError(code: number) {
  if (code === 1) return 'No se pudo acceder a tu ubicación. Puedes seleccionar el punto manualmente en el mapa.';
  if (code === 3)
    return 'No pudimos obtener tu ubicación a tiempo. Inténtalo nuevamente o selecciona el punto en el mapa.';

  return 'Tu ubicación no está disponible. Puedes seleccionar el punto manualmente en el mapa.';
}
