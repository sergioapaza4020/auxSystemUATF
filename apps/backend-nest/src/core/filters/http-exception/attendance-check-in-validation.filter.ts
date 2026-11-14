import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { AttendanceCheckInCode } from '@common/enums/attendanceCheckInCode';
import { HttpExceptionFilter } from './http-exception.filter';

// Normalize global ValidationPipe failures on this endpoint only. Do not include
// validation values or the original request body in the public response.
@Catch(BadRequestException)
export class AttendanceCheckInValidationFilter implements ExceptionFilter<BadRequestException> {
  catch(_exception: BadRequestException, host: ArgumentsHost) {
    new HttpExceptionFilter().catch(
      new AttendanceCheckInException(
        AttendanceCheckInCode.LOCATION_INVALID,
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );
  }
}
