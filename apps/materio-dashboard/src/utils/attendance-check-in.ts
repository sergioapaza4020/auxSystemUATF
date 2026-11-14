import axios from 'axios';

import { BrowserLocationError } from './browser-geolocation';

export function attendanceCheckInErrorCode(error: unknown): string | undefined {
  const data: unknown = axios.isAxiosError(error) ? error.response?.data : undefined;

  return data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : undefined;
}

const messages: Record<string, string> = {
  OUTSIDE_AREA: 'No te encuentras dentro de la zona permitida para registrar esta asistencia.',
  LOW_ACCURACY:
    'No pudimos obtener una ubicación suficientemente precisa. Activa la ubicación precisa de tu dispositivo, mejora la señal e inténtalo nuevamente.',
  SESSION_NOT_STARTED: 'La sesión de asistencia todavía no está disponible.',
  SESSION_CLOSED: 'La sesión de asistencia ya finalizó.',
  SESSION_CANCELLED: 'La sesión de asistencia fue cancelada.',
  SESSION_NOT_GEOLOCATION: 'No se puede registrar asistencia en esta sesión en este momento.',
  SESSION_NOT_FOUND: 'Esta sesión de asistencia ya no está disponible.',
  NOT_ENROLLED: 'No pudimos validar tu matrícula para esta sesión.',
  ALREADY_REGISTERED: 'Tu asistencia ya fue registrada.',
  LOCATION_INVALID: 'No pudimos validar la ubicación obtenida. Inténtalo nuevamente.',
  SESSION_CONTEXT_INVALID: 'No se puede registrar asistencia en esta sesión en este momento.',
};

export function getAttendanceCheckInErrorMessage(error: unknown): string {
  if (error instanceof BrowserLocationError) {
    if (error.code === 1)
      return 'No pudimos acceder a tu ubicación. Debes permitir el acceso para registrar tu asistencia. Puedes habilitar el permiso desde la configuración del navegador e intentarlo nuevamente.';
    if (error.code === 2)
      return 'No pudimos obtener tu ubicación. Verifica que la ubicación de tu dispositivo esté activada e inténtalo nuevamente.';
    if (error.code === 3) return 'No pudimos obtener tu ubicación a tiempo. Inténtalo nuevamente.';

    return 'Tu navegador o dispositivo no permite obtener la ubicación. Contacta al auxiliar si necesitas un registro manual.';
  }

  const code = attendanceCheckInErrorCode(error);

  if (code && messages[code]) return messages[code];
  if (axios.isAxiosError(error) && error.response?.status === 403)
    return 'No tienes permiso para registrar asistencia. Contacta al auxiliar o al administrador para revisar tu acceso.';
  if (axios.isAxiosError(error) && error.response?.status === 429)
    return 'Has realizado varios intentos. Espera un momento antes de volver a intentar.';

  // Do not echo raw server errors: they may contain technical or location details.
  return 'No pudimos completar el registro. Verifica tu conexión e inténtalo nuevamente.';
}

export const checkInRequiresRefresh = (code?: string) =>
  !!code &&
  [
    'SESSION_NOT_STARTED',
    'SESSION_CLOSED',
    'SESSION_CANCELLED',
    'SESSION_NOT_GEOLOCATION',
    'SESSION_NOT_FOUND',
    'NOT_ENROLLED',
    'ALREADY_REGISTERED',
    'SESSION_CONTEXT_INVALID',
  ].includes(code);
