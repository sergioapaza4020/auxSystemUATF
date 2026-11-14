import axios from 'axios';

import { attendanceQrErrorCode } from './attendance-qr';

const messages: Record<string, string> = {
  QR_TOKEN_EXPIRED: 'El código QR caducó. Escanea nuevamente el código que muestra tu auxiliar.',
  QR_TOKEN_INVALID: 'El código QR no es válido. Vuelve a escanear el código mostrado durante la clase.',
  QR_NOT_AVAILABLE: 'No es posible registrar asistencia mediante QR en este momento.',
  SESSION_NOT_STARTED: 'La sesión de asistencia todavía no está disponible. Escanea nuevamente cuando se abra.',
  SESSION_CLOSED: 'La sesión de asistencia ya finalizó.',
  SESSION_CANCELLED: 'La sesión de asistencia fue cancelada.',
  SESSION_NOT_FOUND: 'No es posible consultar esta sesión de asistencia.',
  ALREADY_REGISTERED: 'Ya existe un registro de asistencia para esta sesión.',
  NOT_ENROLLED: 'No pudimos validar tu matrícula para esta sesión.',
  SESSION_CONTEXT_INVALID: 'No es posible registrar asistencia en esta sesión en este momento.',
};

export function studentQrError(error: unknown): string {
  if (axios.isAxiosError(error) && error.response?.status === 403)
    return 'No tienes permiso para registrar asistencia mediante QR. Consulta al administrador e inicia sesión nuevamente si se actualizaron tus permisos.';
  if (axios.isAxiosError(error) && error.response?.status === 429)
    return 'Has realizado demasiados intentos. Espera un momento antes de volver a intentar.';

  return (
    messages[attendanceQrErrorCode(error) ?? ''] ??
    'No pudimos completar la consulta. Revisa tu conexión e inténtalo de nuevo.'
  );
}

export function qrRetryAfter(error: unknown): number {
  if (!axios.isAxiosError(error) || error.response?.status !== 429) return 0;
  const value: unknown = error.response.headers?.['retry-after'];

  if (typeof value !== 'string' && typeof value !== 'number') return Date.now() + 30000;
  const seconds = Number(value);
  const until = Number.isFinite(seconds) && seconds >= 0 ? Date.now() + seconds * 1000 : Date.parse(String(value));

  return Number.isFinite(until) ? Math.max(Date.now() + 1000, until) : Date.now() + 30000;
}

export const qrUncertainFailure = (error: unknown) =>
  !axios.isAxiosError(error) || !error.response || error.response.status >= 500 || error.response.status === 408;

export function qrRequiresRescan(error: unknown): boolean {
  return (
    [
      'QR_TOKEN_EXPIRED',
      'QR_TOKEN_INVALID',
      'SESSION_CLOSED',
      'SESSION_CANCELLED',
      'SESSION_NOT_STARTED',
      'SESSION_NOT_FOUND',
      'NOT_ENROLLED',
      'SESSION_CONTEXT_INVALID',
      'QR_NOT_AVAILABLE',
      'ALREADY_REGISTERED',
    ].includes(attendanceQrErrorCode(error) ?? '') ||
    (axios.isAxiosError(error) && error.response?.status === 403)
  );
}
