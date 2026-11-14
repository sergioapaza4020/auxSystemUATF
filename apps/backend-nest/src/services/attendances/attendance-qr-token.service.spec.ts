import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { AttendanceQrTokenService } from './attendance-qr-token.service';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';

// Synthetic test-only material, never usable by a deployed environment.
const key = Buffer.alloc(32, 0x42);
const config = {
  ATTENDANCE_QR_ACTIVE_KID: 'test',
  ATTENDANCE_QR_KEYS_JSON: JSON.stringify({ test: key.toString('base64') }),
};
const boundary = new Date('2026-11-12T13:00:00Z');
const session = (): AttendanceSession =>
  Object.assign(new AttendanceSession(), {
    idAttendanceSession: 123,
    mode: Mode.QR,
    date: '2026-11-12',
    startsAt: new Date(boundary.getTime() - 60000),
    openedAt: new Date(boundary.getTime() - 60000),
    endsAt: new Date(boundary.getTime() + 120000),
    closedAt: null,
    cancelledAt: null,
    latitude: null,
    longitude: null,
    radiusMeters: null,
    maximumAcceptedAccuracy: null,
  });

describe('QR HMAC and temporal contract', () => {
  let service: AttendanceQrTokenService;
  beforeEach(() => {
    jest.replaceProperty(process, 'env', { ...process.env, ...config });
    service = new AttendanceQrTokenService();
  });
  afterEach(() => jest.restoreAllMocks());

  it('uses the documented HMAC message, is deterministic across independent instances, and contains no user JWT', () => {
    const issued = service.issue(session(), boundary);
    const slot = Math.floor(boundary.getTime() / 30000);
    const body = `q1.test.123.${slot}`;
    expect(issued.token).toBe(
      `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`,
    );
    expect(new AttendanceQrTokenService().issue(session(), boundary)).toEqual(issued);
    expect(issued).toMatchObject({
      rotateAt: new Date(boundary.getTime() + 30000),
      expiresAt: new Date(boundary.getTime() + 35000),
    });
  });

  it('emits the same token from two separate Node processes with identical configuration', () => {
    const script = `
      const { AttendanceQrTokenService } = require('./src/services/attendances/attendance-qr-token.service');
      const sample = ${JSON.stringify(session())};
      for (const field of ['startsAt', 'endsAt', 'openedAt']) sample[field] = new Date(sample[field]);
      process.stdout.write(new AttendanceQrTokenService().issue(sample, new Date('${boundary.toISOString()}')).token);
    `;
    const run = () =>
      execFileSync(
        process.execPath,
        [
          '-r',
          require.resolve('ts-node/register'),
          '-r',
          require.resolve('tsconfig-paths/register'),
          '-e',
          script,
        ],
        { env: { ...process.env }, windowsHide: true, timeout: 30000 },
      ).toString();
    expect(run()).toBe(service.issue(session(), boundary).token);
    expect(run()).toBe(service.issue(session(), boundary).token);
  }, 60000);

  it('validates a token emitted by the parent in another backend process', () => {
    const token = service.issue(session(), boundary).token;
    const script = `
      const { AttendanceQrTokenService } = require('./src/services/attendances/attendance-qr-token.service');
      const sample = ${JSON.stringify(session())};
      for (const field of ['startsAt','endsAt','openedAt']) sample[field] = new Date(sample[field]);
      const instance = new AttendanceQrTokenService();
      const verified = instance.verify(process.env.QR6_SYNTHETIC_TOKEN,123);
      instance.validatePeriod(verified,sample,new Date('${boundary.toISOString()}'));
      process.stdout.write(JSON.stringify({accepted:true,idSession:verified.idSession}));
    `;
    const output = execFileSync(
      process.execPath,
      [
        '-r',
        require.resolve('ts-node/register'),
        '-r',
        require.resolve('tsconfig-paths/register'),
        '-e',
        script,
      ],
      {
        env: { ...process.env, QR6_SYNTHETIC_TOKEN: token },
        windowsHide: true,
        timeout: 30000,
      },
    ).toString();
    expect(JSON.parse(output)).toEqual({ accepted: true, idSession: 123 });
  }, 35000);
  it.each(['JWT_ACCESS_SECRET', 'JWT_ACCESS_REFRESH'])(
    'fails closed if QR key bytes are reused as %s',
    (name) => {
      process.env[name] = key.toString('utf8');
      expect(() => new AttendanceQrTokenService().issue(session(), boundary)).toThrow();
    },
  );
  it('rejects a token from a clock ahead of the verifying process', () => {
    const issued = service.issue(session(), boundary);
    expect(() =>
      service.validatePeriod(
        service.verify(issued.token, 123),
        session(),
        new Date(boundary.getTime() - 1),
      ),
    ).toThrow();
  });
  it.each([0, 29999, 30000, 30001, 34999])(
    'accepts the current/previous period at +%i milliseconds',
    (offset) => {
      const token = service.verify(service.issue(session(), boundary).token, 123);
      expect(
        service.validatePeriod(token, session(), new Date(boundary.getTime() + offset)),
      ).toEqual(new Date(boundary.getTime() + 35000));
    },
  );
  it.each([35000, 60000, 65000])(
    'rejects expiry at +%i milliseconds without extra tolerance',
    (offset) => {
      const token = service.verify(service.issue(session(), boundary).token, 123);
      expect(() =>
        service.validatePeriod(token, session(), new Date(boundary.getTime() + offset)),
      ).toThrow('El código QR ha vencido');
    },
  );
  it('rejects a future period and a period that ended before activation', () => {
    const token = service.verify(
      service.issue(session(), new Date(boundary.getTime() + 30000)).token,
      123,
    );
    expect(() => service.validatePeriod(token, session(), boundary)).toThrow(
      'El código QR no es válido',
    );
    const old = service.verify(service.issue(session(), boundary).token, 123);
    const later = session();
    later.startsAt = later.openedAt = new Date(boundary.getTime() + 30000);
    expect(() => service.validatePeriod(old, later, new Date(boundary.getTime() + 31000))).toThrow(
      'El código QR no es válido',
    );
  });
  it('truncates validity at session end and refuses closed, cancelled or not-yet-open sessions', () => {
    const short = session();
    short.endsAt = new Date(boundary.getTime() + 1000);
    expect(service.issue(short, boundary).expiresAt).toEqual(short.endsAt);
    expect(() => service.issue(short, short.endsAt!)).toThrow();
    const closed = session();
    closed.closedAt = boundary;
    expect(() => service.issue(closed, boundary)).toThrow();
    const scheduled = session();
    scheduled.startsAt = new Date(boundary.getTime() + 30000);
    expect(() => service.issue(scheduled, boundary)).toThrow();
    const cancelled = session();
    cancelled.cancelledAt = new Date(boundary.getTime() - 60000);
    cancelled.openedAt = null;
    expect(() => service.issue(cancelled, boundary)).toThrow();
  });

  it.each([
    (t: string) => t.replace('q1.', 'q2.'),
    (t: string) => t.replace('.test.', '.unknown.'),
    (t: string) => t.replace('.123.', '.0123.'),
    (t: string) => t.replace('.123.', '.2147483648.'),
    (t: string) => t.replace(/\.\d+\./, '.-1.'),
    (t: string) => t + '=',
    (t: string) => t + '.extra',
    () => 'a'.repeat(129),
    (t: string) => t.slice(0, -1),
    (t: string) => t.replace(/.$/, '*'),
    (t: string) => t.replace(/.$/, t.endsWith('A') ? 'B' : 'A'),
    (t: string) => t.replace(/\.\d+\.([^.]+)$/, '.0001.$1'),
  ])('rejects noncanonical or manipulated token %#', (mutate) => {
    expect(() => service.verify(mutate(service.issue(session(), boundary).token), 123)).toThrow(
      'El código QR no es válido',
    );
  });
  it('binds the token to the route session', () => {
    expect(() => service.verify(service.issue(session(), boundary).token, 124)).toThrow();
  });
  it('accepts a prior verification key during rotation and rejects it after removal', () => {
    const token = service.issue(session(), boundary).token;
    const replacement = Buffer.alloc(32, 0x24).toString('base64');
    process.env.ATTENDANCE_QR_ACTIVE_KID = 'next';
    process.env.ATTENDANCE_QR_KEYS_JSON = JSON.stringify({
      test: key.toString('base64'),
      next: replacement,
    });
    expect(new AttendanceQrTokenService().verify(token, 123).idSession).toBe(123);
    process.env.ATTENDANCE_QR_KEYS_JSON = JSON.stringify({ next: replacement });
    expect(() => new AttendanceQrTokenService().verify(token, 123)).toThrow();
  });
  it.each([
    '{}',
    'invalid-json',
    '{"test":"short"}',
    JSON.stringify({ test: Buffer.alloc(31).toString('base64') }),
  ])('fails closed without affecting other services for config %#', (value) => {
    process.env.ATTENDANCE_QR_KEYS_JSON = value;
    const unavailable = new AttendanceQrTokenService();
    try {
      unavailable.issue(session(), boundary);
      throw new Error('Expected unavailable');
    } catch (error: unknown) {
      expect(error).toMatchObject({ status: 503 });
      expect(JSON.stringify(error)).not.toContain(value);
    }
  });
});
