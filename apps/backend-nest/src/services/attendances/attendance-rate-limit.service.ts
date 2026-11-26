import { createHash } from 'node:crypto';
import { Injectable, HttpException, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { USER_IMPORT_QUEUE } from '@common/types/user-import-job';

export const ATTENDANCE_RATE_LIMITS = {
  emission: 30,
  context: 60,
  challenge: 12,
  checkIn: 12,
  ownMark: 60,
  audit: 30,
} as const;
export type AttendanceRateOperation = keyof typeof ATTENDANCE_RATE_LIMITS;

// INCR and expiration are a single operation across all API instances. Never use IP quotas.
export const ATTENDANCE_RATE_LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 or redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {count, redis.call('PTTL', KEYS[1])}`;

@Injectable()
export class AttendanceRateLimitService {
  private readonly logger = new Logger(AttendanceRateLimitService.name);
  private lastWarning = 0;
  constructor(@InjectQueue(USER_IMPORT_QUEUE) private readonly queue: Queue) {}

  async check(user: number, operation: AttendanceRateOperation): Promise<void> {
    const subject = createHash('sha256').update(String(user)).digest('hex');
    const key = `uatf:attendance:rate:v1:${operation}:${subject}`;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let result: unknown;
    try {
      result = await Promise.race([
        this.queue.client.then((client) => {
          client.defineCommand('attendanceRateV1', { numberOfKeys: 1, lua: ATTENDANCE_RATE_LUA });
          return client.runCommand('attendanceRateV1', [key, 60000]);
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('STORE_TIMEOUT')), 1500);
        }),
      ]);
      if (
        !Array.isArray(result) ||
        result.length !== 2 ||
        !result.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)) ||
        result[0] < 1 ||
        result[1] < 0
      )
        throw new Error('STORE_RESPONSE');
    } catch {
      if (Date.now() - this.lastWarning > 30000) {
        this.lastWarning = Date.now();
        this.logger.warn('attendance_rate_store_unavailable');
      }
      // Fail closed before invoking the handler. Never log Redis config or request bodies.
      throw new ServiceUnavailableException(
        'El registro de asistencia no está disponible en este momento. Espera un momento antes de volver a intentarlo.',
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (result[0] > ATTENDANCE_RATE_LIMITS[operation]) {
      throw new HttpException(
        {
          message: 'Demasiados intentos. Espera antes de reintentar.',
          retryAfter: Math.max(1, Math.ceil(result[1] / 1000)),
        },
        429,
      );
    }
  }
}
