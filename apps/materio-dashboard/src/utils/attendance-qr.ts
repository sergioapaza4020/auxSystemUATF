import axios from 'axios';

const messages: Record<string, string> = {
  SESSION_DATE_PAST: 'No puedes crear o configurar una sesión con una fecha anterior a hoy en Bolivia.',
  SESSION_START_PAST: 'El inicio debe ser futuro. Corrige el horario o utiliza Abrir ahora.',
  SESSION_DURATION_INVALID: 'La duración debe ser de al menos 1 minuto y usar minutos enteros.',
  SESSION_DURATION_OUT_OF_RANGE: 'La duración excede el rango de fechas admitido.',
  QR_NOT_AVAILABLE: 'El código QR no está disponible. Revisa el estado de la sesión o contacta al administrador.',
  SESSION_NOT_STARTED: 'La sesión todavía no está abierta.',
  SESSION_CLOSED: 'La sesión está cerrada.',
  SESSION_CANCELLED: 'La sesión fue cancelada.',
  SESSION_NOT_FOUND: 'No se encontró la sesión.',
  SESSION_CONTEXT_INVALID: 'El contexto académico de la sesión no es válido.',
  SESSION_ACADEMIC_CONTEXT_INVALID: 'La matrícula del auxiliar o el contexto académico no están activos.',
  SESSION_ALREADY_ACTIVATED: 'La sesión ya fue activada. Actualiza su estado.',
  SESSION_NOT_DRAFT: 'Solo se pueden configurar borradores.',
  SESSION_NOT_OPEN: 'La sesión no está abierta.',
  SESSION_ALREADY_CLOSED: 'La sesión ya está cerrada.',
  SESSION_DATE_CONFLICT: 'Ya existe una sesión del auxiliar en esa fecha.',
  SESSION_WINDOW_EXPIRED: 'La hora de finalización ya pasó. Revisa el horario.',
  SESSION_CANNOT_CANCEL: 'Solo se pueden cancelar borradores o sesiones programadas sin marcas.',
  SESSION_CANNOT_DELETE: 'Esta sesión debe conservarse en el historial.',
  SESSION_HAS_ATTENDANCE: 'La sesión ya contiene marcas y no permite esta operación.',
  QR_CONFIGURATION_INVALID: 'Revisa las fechas y horas de inicio y fin.',
  QR_CONFIGURATION_INCOMPLETE: 'Completa y guarda el inicio y fin de la sesión.',
  INVALID_TIME_WINDOW: 'La finalización debe ser posterior al inicio.',
  OUTSIDE_SEMESTER: 'El horario debe estar dentro del semestre.',
  SEMESTER_BOUNDARIES_INVALID: 'Revisa la configuración del semestre con el administrador.',
  SESSION_DATE_INVALID: 'La fecha debe coincidir con el inicio de la sesión en Bolivia.',
};

export function attendanceQrErrorCode(error: unknown): string | null {
  const data: unknown = axios.isAxiosError(error) ? error.response?.data : null;

  if (!data || typeof data !== 'object') return null;
  if ('code' in data && typeof data.code === 'string') return data.code;

  return 'message' in data && typeof data.message === 'string' ? data.message : null;
}

export function attendanceQrError(error: unknown): string {
  const code = attendanceQrErrorCode(error);

  if (code && messages[code]) return messages[code];
  if (axios.isAxiosError(error) && error.response?.status === 403) return 'No tienes permiso para esta operación.';
  if (axios.isAxiosError(error) && error.response?.status === 429) return 'Espera un momento antes de reintentar.';

  return 'No fue posible completar la operación QR. Actualiza la sesión e inténtalo de nuevo.';
}

export function qrUnavailable(error: unknown): boolean {
  return (
    [
      'SESSION_CLOSED',
      'SESSION_CANCELLED',
      'QR_NOT_AVAILABLE',
      'SESSION_NOT_STARTED',
      'SESSION_NOT_FOUND',
      'SESSION_CONTEXT_INVALID',
    ].includes(attendanceQrErrorCode(error) ?? '') ||
    (axios.isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0))
  );
}
