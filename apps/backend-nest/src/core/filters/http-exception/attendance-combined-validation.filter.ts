import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { AttendanceCheckInCode as Code } from '@common/enums/attendanceCheckInCode';
import { HttpExceptionFilter } from './http-exception.filter';

@Catch(BadRequestException)
export class AttendanceCombinedValidationFilter implements ExceptionFilter<BadRequestException> {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<Request>();
    const response = exception.getResponse();
    const messages: unknown =
      typeof response === 'object' && response !== null && 'message' in response
        ? response.message
        : null;
    const location =
      Array.isArray(messages) &&
      messages.some(
        (message: unknown) =>
          typeof message === 'string' && /^(latitude|longitude|accuracy)\b/.test(message),
      );
    const code = request.path.endsWith('/combined-challenge')
      ? Code.QR_TOKEN_INVALID
      : location
        ? Code.LOCATION_INVALID
        : Code.COMBINED_AUTHORIZATION_INVALID;
    new HttpExceptionFilter().catch(
      new AttendanceCheckInException(code, HttpStatus.BAD_REQUEST),
      host,
    );
  }
}
