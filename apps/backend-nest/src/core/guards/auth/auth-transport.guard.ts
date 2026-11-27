import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  GoneException,
  Header,
  Injectable,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from '@core/decorators/public/public.decorator';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const AUTH_TRANSPORT_HEADER = 'x-uatf-auth-transport';
const LEGACY_DEADLINE = Date.parse('2026-12-08T00:00:00Z');
const Transport = Reflector.createDecorator<'next' | 'legacy'>();

@Injectable()
class AuthTransportGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const legacy = this.reflector.get(Transport, context.getHandler()) === 'legacy';
    const nextKey = process.env.AUTH_TRANSPORT_KEY;
    const key = legacy ? process.env.AUTH_LEGACY_TRANSPORT_KEY : nextKey;
    const { headers } = context.switchToHttp().getRequest<Request>();
    const provided = headers[AUTH_TRANSPORT_HEADER];

    if (
      !key ||
      !/^[a-f0-9]{64}$/.test(key) ||
      (legacy && key === nextKey) ||
      typeof provided !== 'string' ||
      !/^[a-f0-9]{64}$/.test(provided) ||
      !timingSafeEqual(
        createHash('sha256').update(key).digest(),
        createHash('sha256').update(provided).digest(),
      )
    ) {
      throw new ForbiddenException('No pudimos verificar la solicitud de autenticación.');
    }

    if (legacy) {
      const configured = process.env.AUTH_LEGACY_TRANSPORT_UNTIL;
      const deadline = configured === undefined ? LEGACY_DEADLINE : Date.parse(configured);
      if (!Number.isFinite(deadline) || Date.now() >= Math.min(deadline, LEGACY_DEADLINE)) {
        throw new GoneException('Actualiza la aplicación para volver a iniciar sesión.');
      }
    }

    return true;
  }
}

export function AuthTransport(kind: 'next' | 'legacy') {
  return applyDecorators(
    // Skip the end-user JWT guard. This route authenticates the calling server.
    Public(),
    Transport(kind),
    UseGuards(AuthTransportGuard),
    Header('Cache-Control', 'no-store'),
  );
}
