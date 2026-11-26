import { ArgumentsHost, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AttendanceCheckInException } from '@common/errors/attendance-check-in.exception';
import { AttendanceCheckInCode } from '@common/enums/attendanceCheckInCode';
import { HttpExceptionFilter } from './http-exception.filter';

function captureResponse(exception: Error) {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const setHeader = jest.fn();
  const getResponse = jest.fn().mockReturnValue({ status, setHeader });
  const getRequest = jest.fn().mockReturnValue({ url: '/api/attendances/sessions/1/qr?secret=1' });
  const host = { switchToHttp: () => ({ getResponse, getRequest }) } as unknown as ArgumentsHost;

  new HttpExceptionFilter().catch(exception, host);
  return { json, status, setHeader };
}

describe('HttpExceptionFilter', () => {
  it('should be defined', () => {
    expect(new HttpExceptionFilter()).toBeDefined();
  });

  it('localizes validation messages and preserves nested fields and limits', () => {
    const { status, json } = captureResponse(
      new BadRequestException([
        'rows.0.score must not be greater than 100',
        'El RU es obligatorio.',
      ]),
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: false,
        statusCode: 400,
        message: [
          'El campo «rows.0.score» debe ser menor o igual que 100.',
          'El RU es obligatorio.',
        ],
      }),
    );
  });

  it('keeps the attendance code, status and privacy headers', () => {
    const { status, json, setHeader } = captureResponse(
      new AttendanceCheckInException(AttendanceCheckInCode.ALREADY_REGISTERED, 409),
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ALREADY_REGISTERED',
        message: 'Tu asistencia ya está registrada para esta sesión.',
        path: '/api/attendances/sessions/1/qr',
      }),
    );
  });

  it('localizes default authentication failures', () => {
    const { json } = captureResponse(new UnauthorizedException());
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: 'Inicia sesión para continuar.' }),
    );
  });

  it('returns a public message for unhandled infrastructure errors', () => {
    const { json } = captureResponse(new Error('SELECT secret FROM private_table'));
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'No pudimos completar la operación. Inténtalo nuevamente.',
      }),
    );
  });
});
