import axios from 'axios';

import type { AttendanceRegistrationMethod } from '@/interfaces/attendances/attendance.interface';

export const attendanceMethodLabels: Record<AttendanceRegistrationMethod, string> = {
  MANUAL: 'Manual',
  GEOLOCATION: 'Geolocalización',
  QR: 'Código QR',
  GEOLOCATION_QR: 'QR + ubicación',
};

export const isProtectedAttendance = (method?: AttendanceRegistrationMethod) =>
  method === 'GEOLOCATION' || method === 'QR' || method === 'GEOLOCATION_QR';

export const normalizeManualReason = (value: string) => value.replace(/\p{Cf}/gu, '').trim();

export function manualReasonError(value: string) {
  const reason = normalizeManualReason(value);

  if (value.length > 500) return 'El motivo debe tener como máximo 500 caracteres.';
  if ((reason.match(/[\p{L}\p{N}]/gu) ?? []).length < 10)
    return 'Escribe un motivo con al menos 10 letras o dígitos; espacios y puntuación no cuentan.';

  return '';
}

const messages: Record<string, string> = {
  MANUAL_REASON_REQUIRED: 'Escribe un motivo válido y diferente al anterior para esta contingencia.',
  MANUAL_OVERRIDE_FORBIDDEN: 'No está autorizada esta contingencia o corrección. Consulta al responsable.',
  ATTENDANCE_EVIDENCE_PROTECTED: 'La marca tiene evidencia protegida y no puede sustituirse.',
  SESSION_CLOSED: 'La sesión está cerrada para esta operación.',
  SESSION_NOT_OPEN: 'La sesión no está abierta para esta operación.',
  SESSION_CANCELLED: 'La sesión está cancelada.',
  NOT_ENROLLED: 'El estudiante no tiene una matrícula elegible en esta sesión.',
  SESSION_ACADEMIC_CONTEXT_INVALID: 'El contexto académico de la sesión ya no está activo.',
};

// Never render raw database errors or arbitrary server bodies in the auxiliary dialogs.
export function combinedAttendanceError(error: unknown) {
  if (!axios.isAxiosError(error)) return 'No se pudo completar la operación. Actualiza e inténtalo de nuevo.';
  const data: unknown = error.response?.data;
  const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : '';

  return (
    messages[code] ??
    (error.response?.status === 403
      ? 'No tienes autorización para consultar o modificar esta sesión.'
      : error.response?.status === 404
        ? 'La sesión o matrícula no está disponible.'
        : 'No se pudo confirmar la operación. Consulta el estado de la sesión.')
  );
}

export const mayHaveSavedAttendance = (error: unknown) =>
  !axios.isAxiosError(error) || !error.response || error.response.status >= 500 || error.response.status === 408;
