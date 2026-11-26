import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { toPublicHttpMessage, unexpectedHttpMessage } from './http-message';

@Catch()
export class HttpExceptionFilter<T> implements ExceptionFilter {
  catch(exception: T, host: ArgumentsHost) {
    const ctx = host.switchToHttp();

    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const qrRequest = /\/attendances\/sessions\/[^/]+\/(?:qr|combined|audit)(?:[/?-]|$)/.test(
      request.url,
    );
    if (qrRequest) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Referrer-Policy', 'no-referrer');
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : unexpectedHttpMessage;

    const rawMessage =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as { message?: string | string[] }).message
        : exceptionResponse;
    const code =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'code' in exceptionResponse &&
      typeof exceptionResponse.code === 'string'
        ? exceptionResponse.code
        : undefined;
    const message =
      typeof rawMessage === 'string'
        ? toPublicHttpMessage(rawMessage, status)
        : Array.isArray(rawMessage)
          ? rawMessage.map((item: unknown) =>
              typeof item === 'string' ? toPublicHttpMessage(item, status) : item,
            )
          : rawMessage;

    response.status(status).json({
      status: false,
      statusCode: status,
      message,
      ...(code !== undefined ? { code } : {}),
      path: qrRequest ? request.url.split('?')[0] : request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
