import { HttpException, HttpStatus } from '@nestjs/common';
import { AttendanceCheckInCode as Code } from '@common/enums/attendanceCheckInCode';

type ErrorCode = Exclude<Code, Code.SUCCESS>;
const messages: Record<ErrorCode, string> = {
  COMBINED_AUTHORIZATION_INVALID: 'La autorización no es válida. Escanea nuevamente.',
  COMBINED_AUTHORIZATION_EXPIRED: 'La autorización ha vencido. Escanea nuevamente.',
  MANUAL_REASON_REQUIRED:
    'Describe el motivo con un máximo de 500 caracteres y al menos 10 letras o números.',
  MANUAL_OVERRIDE_FORBIDDEN: 'Esta operación manual no está permitida.',
  ATTENDANCE_EVIDENCE_PROTECTED:
    'La evidencia de asistencia no puede sobrescribirse ni eliminarse.',

  QR_TOKEN_INVALID: 'El código QR no es válido.',
  QR_TOKEN_EXPIRED: 'El código QR ha vencido. Escanea el código actual.',
  QR_NOT_AVAILABLE: 'El registro QR no está disponible.',
  SESSION_NOT_FOUND: 'Sesión no encontrada.',
  SESSION_NOT_GEOLOCATION: 'La sesión no permite registro por geolocalización.',
  SESSION_NOT_STARTED: 'La sesión todavía no está abierta.',
  SESSION_CLOSED: 'La sesión está cerrada.',
  SESSION_CANCELLED: 'La sesión fue cancelada.',
  NOT_ENROLLED: 'Necesitas una matrícula activa en esta materia y semestre.',
  ALREADY_REGISTERED: 'Tu asistencia ya está registrada para esta sesión.',
  LOW_ACCURACY: 'La ubicación no es lo bastante precisa. Espera a que mejore la señal.',
  OUTSIDE_AREA: 'La ubicación está fuera del área permitida.',
  LOCATION_INVALID: 'Los datos de ubicación no son válidos.',
  SESSION_CONTEXT_INVALID: 'El contexto académico o la configuración de la sesión no son válidos.',
};

export class AttendanceCheckInException extends HttpException {
  constructor(code: ErrorCode, status: HttpStatus) {
    super({ code, message: messages[code] }, status);
  }
}
