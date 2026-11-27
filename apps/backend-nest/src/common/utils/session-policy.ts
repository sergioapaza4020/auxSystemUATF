import { UnauthorizedException } from '@nestjs/common';
import { jwtDurationSeconds } from './jwt-duration';

export function sessionDeadline(rememberMe: boolean, now: Date): Date {
  const key = rememberMe ? 'AUTH_REMEMBERED_SESSION_TTL' : 'AUTH_SESSION_TTL';
  const seconds = jwtDurationSeconds(process.env[key] ?? (rememberMe ? '30d' : '12h'), key);
  const maximum = rememberMe ? 30 * 86400 : 12 * 3600;
  if (seconds > maximum) throw new Error(`${key} exceeds the supported absolute maximum`);
  return new Date(now.getTime() + seconds * 1000);
}

export function remainingSeconds(
  expiresAt: Date,
  issuedAt = Math.floor(Date.now() / 1000),
): number {
  const seconds = Math.floor(expiresAt.getTime() / 1000) - issuedAt;
  if (seconds <= 0)
    throw new UnauthorizedException('Tu sesión ha vencido. Inicia sesión nuevamente.');
  return seconds;
}
