import { randomUUID } from 'node:crypto';
import { tap } from 'rxjs';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AttendanceRateLimitService,
  AttendanceRateOperation,
} from './attendance-rate-limit.service';

const operations: Record<string, AttendanceRateOperation> = {
  getQr: 'emission',
  getQrContext: 'context',
  combinedChallenge: 'challenge',
  checkIn: 'checkIn',
  checkInQr: 'checkIn',
  combinedCheckIn: 'checkIn',
  getQrOwnMark: 'ownMark',
  getAudit: 'audit',
};

@Injectable()
export class AttendanceRateLimitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AttendanceRateLimitInterceptor.name);
  constructor(private readonly limiter: AttendanceRateLimitService) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    // Interceptors run after JWT and permission guards, including across multiple API nodes.
    const operation =
      context.getClass().name === 'AttendancesController'
        ? operations[context.getHandler().name]
        : undefined;
    const lifecycle: Record<string, string> = {
      createSession: 'session_create',
      updateSessionTopic: 'session_topic_update',
      activate: 'session_activate',
      openNow: 'session_open_now',
      close: 'session_close',
      cancel: 'session_cancel',
      saveAttendances: 'manual_save',
    };
    const event =
      context.getClass().name === 'AttendancesController'
        ? (operation ?? lifecycle[context.getHandler().name])
        : undefined;
    if (!event) return next.handle();
    const request = context.switchToHttp().getRequest<Request & { user?: { idUser?: number } }>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user?.idUser;
    if (!Number.isSafeInteger(user) || !user || user < 1) throw new UnauthorizedException();
    const requestId = randomUUID();
    response.setHeader('X-Request-ID', requestId);
    const started = performance.now();
    const record = (status: number) =>
      this.logger.log({
        event: 'attendance_operation',
        ...(event === 'session_topic_update'
          ? {
              actorId: user,
              sessionId: Number(request.params?.idSession),
              occurredAt: new Date().toISOString(),
            }
          : {}),
        operation: event,
        status,
        latencyMs: Math.round(performance.now() - started),
        requestId,
      });
    try {
      if (operation) await this.limiter.check(user, operation);
    } catch (error) {
      if (error instanceof HttpException) {
        const body = error.getResponse();
        const retryAfter =
          typeof body === 'object' && 'retryAfter' in body && typeof body.retryAfter === 'number'
            ? body.retryAfter
            : 10;
        response.setHeader('Retry-After', String(retryAfter));
      }
      record(error instanceof HttpException ? error.getStatus() : 500);
      throw error;
    }
    return next.handle().pipe(
      tap({
        next: () => record(response.statusCode ?? 200),
        error: (error: unknown) => record(error instanceof HttpException ? error.getStatus() : 500),
      }),
    );
  }
}
