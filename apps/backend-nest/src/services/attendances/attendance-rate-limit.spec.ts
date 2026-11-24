import { Queue } from 'bullmq';
import { ExecutionContext, HttpException, Logger } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { AttendanceRateLimitService, ATTENDANCE_RATE_LUA } from './attendance-rate-limit.service';
import { AttendanceRateLimitInterceptor } from './attendance-rate-limit.interceptor';

describe('Shared attendance quota integration contract', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  function fixture() {
    // Only a unit store model: no claim this executes Lua in real Redis.
    const counts = new Map<string, number>();
    const client = {
      defineCommand: jest.fn(),
      runCommand: jest.fn((_: string, args: [string, number]) => {
        const count = (counts.get(args[0]) ?? 0) + 1;
        counts.set(args[0], count);
        return Promise.resolve([count, 60000]);
      }),
    };
    const queue = { client: Promise.resolve(client) } as unknown as Queue;
    return {
      client,
      a: new AttendanceRateLimitService(queue),
      b: new AttendanceRateLimitService(queue),
    };
  }
  it('shares per-user/operation counters between two service instances and never uses classroom IP', async () => {
    const { a, b, client } = fixture();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 13 }, (_, i) => (i % 2 ? a : b).check(2, 'challenge')),
    );
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(12);
    const rejected = outcomes.find((o) => o.status === 'rejected');
    expect(rejected?.reason).toBeInstanceOf(HttpException);
    await expect(a.check(3, 'challenge')).resolves.toBeUndefined();
    await expect(a.check(2, 'context')).resolves.toBeUndefined();
    expect(client.defineCommand).toHaveBeenCalledWith('attendanceRateV1', {
      numberOfKeys: 1,
      lua: ATTENDANCE_RATE_LUA,
    });
    expect(client.runCommand.mock.calls[0][1][0]).toMatch(
      /^uatf:attendance:rate:v1:challenge:[a-f0-9]{64}$/,
    );
  });
  it('does not exhaust a shared-IP classroom with 50 distinct authenticated users', async () => {
    const { a } = fixture();
    await expect(
      Promise.all(Array.from({ length: 50 }, (_, i) => a.check(i + 1, 'challenge'))),
    ).resolves.toHaveLength(50);
  });
  it('fails closed on store errors, invalid responses and a bounded wait', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const { a, client } = fixture();
    client.runCommand.mockRejectedValueOnce(new Error('secret connection data'));
    await expect(a.check(2, 'checkIn')).rejects.toMatchObject({ status: 503 });
    client.runCommand.mockResolvedValueOnce([-1, 0]);
    await expect(a.check(2, 'checkIn')).rejects.toMatchObject({ status: 503 });
    jest.useFakeTimers();
    client.runCommand.mockImplementationOnce(() => new Promise(() => undefined));
    const pending = expect(a.check(2, 'checkIn')).rejects.toMatchObject({ status: 503 });
    await jest.advanceTimersByTimeAsync(1500);
    await pending;
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('secret'));
  });
  it('runs after authentication, exposes Retry-After and never invokes a limited handler', async () => {
    const { a } = fixture();
    for (let i = 0; i < 12; i++) await a.check(2, 'challenge');
    const interceptor = new AttendanceRateLimitInterceptor(a);
    const setHeader = jest.fn();
    const next = { handle: jest.fn(() => of('ok')) };
    class AttendancesController {}
    function combinedChallenge() {}
    const context = {
      getClass: () => AttendancesController,
      getHandler: () => combinedChallenge,
      switchToHttp: () => ({
        getRequest: () => ({ user: { idUser: 2 } }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
    await expect(interceptor.intercept(context, next)).rejects.toMatchObject({ status: 429 });
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '60');
    expect(next.handle).not.toHaveBeenCalled();
    const other = { ...context, getClass: () => class OtherController {} } as ExecutionContext;
    expect(await firstValueFrom(await interceptor.intercept(other, next))).toBe('ok');
  });
});
