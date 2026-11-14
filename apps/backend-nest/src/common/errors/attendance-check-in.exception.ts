import { HttpException, HttpStatus } from '@nestjs/common';
import { AttendanceCheckInCode as Code } from '@common/enums/attendanceCheckInCode';

type ErrorCode = Exclude<Code, Code.SUCCESS>;
const messages: Record<ErrorCode, string> = {
  QR_TOKEN_INVALID: 'El código QR no es válido.',
  QR_TOKEN_EXPIRED: 'El código QR ha vencido. Escanea el código actual.',
  QR_NOT_AVAILABLE: 'El registro QR no está disponible.',
  SESSION_NOT_FOUND: 'Sesión no encontrada.',
  SESSION_NOT_GEOLOCATION: 'La sesión no permite registro por geolocalización.',
  SESSION_NOT_STARTED: 'La sesión todavía no está abierta.',
  SESSION_CLOSED: 'La sesión está cerrada.',
  SESSION_CANCELLED: 'La sesión fue cancelada.',
  NOT_ENROLLED: 'No tienes una matrícula propia activa para esta materia y semestre.',
  ALREADY_REGISTERED: 'Ya existe un registro de asistencia para esta sesión.',
  LOW_ACCURACY: 'La precisión de la ubicación es insuficiente.',
  OUTSIDE_AREA: 'La ubicación está fuera del área permitida.',
  LOCATION_INVALID: 'Los datos de ubicación no son válidos.',
  SESSION_CONTEXT_INVALID: 'El contexto académico o la configuración de la sesión no son válidos.',
};

export class AttendanceCheckInException extends HttpException {
  constructor(code: ErrorCode, status: HttpStatus) {
    super({ code, message: messages[code] }, status);
  }
}
