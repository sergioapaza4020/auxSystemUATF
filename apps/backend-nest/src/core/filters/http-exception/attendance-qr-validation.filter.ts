import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { AttendanceCheckInCode as Code } from '@common/enums/attendanceCheckInCode';
import { HttpExceptionFilter } from './http-exception.filter';

@Catch(BadRequestException)
export class AttendanceQrValidationFilter implements ExceptionFilter<BadRequestException> {
  catch(_exception: BadRequestException, host: ArgumentsHost) {
    new HttpExceptionFilter().catch(
      new AttendanceCheckInException(Code.QR_TOKEN_INVALID, HttpStatus.BAD_REQUEST),
      host,
    );
  }
}
