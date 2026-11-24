import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import type { Request, Response, NextFunction } from 'express';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { INestApplication, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AttendancesService } from './attendances.service';
import { AttendanceQrTokenService } from './attendance-qr-token.service';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { AttendanceCombinedAuthorization } from 'src/entities/attendance/attendance-combined-authorization.entity';
import { SessionsService } from '../sessions/sessions.service';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceStatus as Status } from '@common/enums/attendanceStatus';
import {
  attendanceAcademicDate,
  isAttendanceSessionComputable,
  getAttendanceSessionState,
} from '@common/utils/attendance-session-policy';
import { academicAttendanceCounts } from '@common/utils/attendance-academic-counts';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
const describePg = pgBin ? describe : describe.skip;

describePg('COMB-3 backend on verified disposable PostgreSQL with real JWT sessions', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let api: AttendancesService;
  let tokens: AttendanceQrTokenService;
  let app: INestApplication<Server>;
  const jwt = new JwtService();
  const secret = 'comb3-synthetic-test-only-jwt-secret';
  const assistantPermissions = [
    'attendance.session.create',
    'attendance.session.update',
    'attendance.session.delete',
    'attendance.session.get-one',
    'attendance.qr.get',
    'attendance.save',
    'attendance.delete',
  ];
  const auth = (id = 2, permissions = ['attendance.qr.check-in'], roles = ['STUDENT']) =>
    jwt.sign({ idUser: id, idSession: id, permissions, roles }, { secret, expiresIn: 600 });
  const assistant = () => auth(1, assistantPermissions, ['ASSISTANT']);
  const path = (id: number, op: string) => `/api/attendances/sessions/${id}/${op}`;
  const location = { latitude: -19.57, longitude: -65.75, accuracy: 10 };
  const payload = (authorization: string) => ({ authorization, ...location });
  const loaded = (id: number) =>
    source.getRepository(AttendanceSession).findOneByOrFail({ idAttendanceSession: id });
  const rowCount = async (table: string, id: number) => {
    const rows: unknown = await source.query(
      `SELECT count(*)::int AS count FROM ${table} WHERE id_attendance_session=$1`,
      [id],
    );
    return (rows as { count: number }[])[0].count;
  };
  const open = async (options: { starts?: Date; ends?: Date; activate?: boolean } = {}) => {
    const now = new Date();
    const created = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(now),
      mode: Mode.GEOLOCATION_QR,
    });
    await api.configureGeolocation(1, created.idAttendanceSession, {
      latitude: location.latitude,
      longitude: location.longitude,
      radiusMeters: 100,
      maximumAcceptedAccuracy: 50,
      startsAt: (options.starts ?? new Date(now.getTime() - 60000)).toISOString(),
      endsAt: (options.ends ?? new Date(now.getTime() + 600000)).toISOString(),
    });
    if (options.activate !== false)
      await api.activateSession(
        1,
        created.idAttendanceSession,
        !options.starts || options.starts <= new Date(),
      );
    return created.idAttendanceSession;
  };
  const challenge = async (id: number, user = 2) =>
    api.combinedChallenge(user, id, { token: (await api.getQr(1, id)).token });
  const authorization = async (id: number, user = 2) => {
    const result = await challenge(id, user);
    if (!result.authorization) throw new Error('Expected synthetic authorization');
    return result.authorization;
  };
  const code = (value: unknown): string | undefined => {
    if (value instanceof HttpException) {
      const response: unknown = value.getResponse();
      if (
        response &&
        typeof response === 'object' &&
        'code' in response &&
        typeof response.code === 'string'
      )
        return response.code;
    }
  };
  const rejectCode = async (operation: Promise<unknown>, expected: string) => {
    try {
      await operation;
    } catch (error) {
      expect(code(error)).toBe(expected);
      return;
    }
    throw new Error(`Expected ${expected}`);
  };
  async function waitForWaiter() {
    for (let i = 0; i < 100; i++) {
      const result: unknown = await source.query(
        'SELECT count(*)::int AS count FROM pg_locks WHERE NOT granted',
      );
      if ((result as { count: number }[])[0].count > 0) return;
      await delay(10);
    }
    throw new Error('Expected session lock waiter');
  }
  async function held(id: number) {
    const runner = source.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.query(
      'SELECT 1 FROM attendance_sessions WHERE id_attendance_session=$1 FOR UPDATE',
      [id],
    );
    return runner;
  }
  beforeAll(async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_SECRET: secret,
      ATTENDANCE_QR_ACTIVE_KID: 'comb',
      ATTENDANCE_QR_KEYS_JSON: JSON.stringify({ comb: Buffer.alloc(32, 23).toString('base64') }),
    });
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    expect(await source.runMigrations({ transaction: 'each' })).toHaveLength(25);
    await source.query(`INSERT INTO users (id_user,email,username,password,name,lastname,ci)
      SELECT n,'comb3-'||n||'@test.invalid','comb3-'||n,'unused','Synthetic','Fixture','comb3-'||n FROM generate_series(1,7)n`);
    await source.query(
      `INSERT INTO courses(id_course,name,code,"group") VALUES(1,'COMB course','COMB',1),(2,'Other','OTHER',1)`,
    );
    const year = new Date().getUTCFullYear();
    await source.query(
      `INSERT INTO semesters(id_semester,year,semester_number,start_date,end_date) VALUES(1,$1,'II',$2,$3),(2,$1,'I',$2,$3)`,
      [year, new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year + 1, 0, 1))],
    );
    await source.query(`INSERT INTO enrollments(id_enrollment,id_user,id_course,id_semester,role)
      VALUES(1,1,1,1,'ASSISTANT'),(2,2,1,1,'STUDENT'),(3,3,1,1,'STUDENT'),(4,4,2,1,'STUDENT'),(5,5,1,2,'STUDENT'),(6,6,1,1,'ASSISTANT')`);
    await source.query(`INSERT INTO user_sessions(id_session,id_user,refresh_token,expires_at,is_active)
      SELECT id_user,id_user,'synthetic-unused',now()+interval '1 day',true FROM users`);
    tokens = new AttendanceQrTokenService();
    api = new AttendancesService(
      source.getRepository(AttendanceSession),
      source.getRepository(Attendance),
      source.getRepository(Enrollment),
      tokens,
    );
    const module = await Test.createTestingModule({
      controllers: [AttendancesController],
      providers: [
        { provide: AttendancesService, useValue: api },
        JwtStrategy,
        {
          provide: SessionsService,
          useValue: new SessionsService(source.getRepository(UserSession)),
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['x-comb-drop-response'] === '1')
        res.json = () => {
          res.destroy();
          return res;
        };
      next();
    });
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  }, 90000);
  afterAll(async () => {
    await app?.close();
    await database?.close();
    jest.restoreAllMocks();
  }, 45000);

  it('creates multiple drafts per date and supports partial configuration and clean deletion', async () => {
    const first = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.GEOLOCATION_QR,
    });
    const second = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.GEOLOCATION_QR,
    });
    expect(second.idAttendanceSession).not.toBe(first.idAttendanceSession);
    expect(getAttendanceSessionState(first, new Date())).toBe('DRAFT');
    await api.configureGeolocation(1, first.idAttendanceSession, { radiusMeters: 80 });
    await api.configureGeolocation(1, first.idAttendanceSession, { maximumAcceptedAccuracy: 40 });
    expect(await loaded(first.idAttendanceSession)).toMatchObject({
      radiusMeters: 80,
      maximumAcceptedAccuracy: 40,
      latitude: null,
      openedAt: null,
    });
    await expect(api.activateSession(1, first.idAttendanceSession)).rejects.toThrow(
      'GEO_CONFIGURATION_INCOMPLETE',
    );
    expect(await rowCount('attendances', first.idAttendanceSession)).toBe(0);
    expect(await rowCount('attendance_combined_authorizations', first.idAttendanceSession)).toBe(0);
    await api.deleteSession(1, first.idAttendanceSession);
    await api.cancelSession(1, second.idAttendanceSession);
    await expect(api.deleteSession(1, second.idAttendanceSession)).rejects.toThrow(
      'SESSION_CANNOT_DELETE',
    );
  });
  it('schedules, cancels and opens now without a date conflict or changing the geofence', async () => {
    const scheduled = await open({ starts: new Date(Date.now() + 60000) });
    expect(getAttendanceSessionState(await loaded(scheduled), new Date())).toBe('SCHEDULED');
    await rejectCode(api.getQr(1, scheduled), 'SESSION_NOT_STARTED');
    await api.cancelSession(1, scheduled);
    const id = await open({ activate: false });
    await api.activateSession(1, id, true);
    expect(await loaded(id)).toMatchObject({
      latitude: '-19.570000',
      longitude: '-65.750000',
      radiusMeters: 100,
    });
    await expect(api.configureGeolocation(1, id, { radiusMeters: 200 })).rejects.toThrow(
      'SESSION_ALREADY_ACTIVATED',
    );
    await expect(api.cancelSession(1, id)).rejects.toThrow('SESSION_CANNOT_CANCEL');
    await expect(api.deleteSession(1, id)).rejects.toThrow('SESSION_CANNOT_DELETE');
  });
  it('completes real HTTP JWT/challenge/location/consume/audit/own-mark/close with no partial attendance', async () => {
    const id = await open();
    const token = (await api.getQr(1, id)).token;
    const discovery = await request(app.getHttpServer())
      .post(path(id, 'qr-context'))
      .auth(auth(), { type: 'bearer' })
      .send({ token })
      .expect(200);
    expect(discovery.body).toMatchObject({
      data: {
        mode: 'GEOLOCATION_QR',
        idAttendanceSession: id,
        ownMark: null,
      },
    });
    expect(await rowCount('attendance_combined_authorizations', id)).toBe(0);
    expect(await rowCount('attendances', id)).toBe(0);
    for (const operation of ['qr-check-in']) {
      const denied = await request(app.getHttpServer())
        .post(path(id, operation))
        .auth(auth(), { type: 'bearer' })
        .send({ token })
        .expect(409);
      expect(denied.body).toMatchObject({ code: 'QR_NOT_AVAILABLE' });
    }
    await request(app.getHttpServer())
      .post(path(id, 'check-in'))
      .auth(auth(2, ['attendance.check-in']), { type: 'bearer' })
      .send(location)
      .expect(409);
    await request(app.getHttpServer())
      .post(path(id, 'combined-challenge'))
      .auth(auth(), { type: 'bearer' })
      .send({ token, enrollmentId: 3 })
      .expect(400);
    expect(await rowCount('attendances', id)).toBe(0);
    expect(await rowCount('attendance_combined_authorizations', id)).toBe(0);
    const initial = await request(app.getHttpServer())
      .post(path(id, 'combined-challenge'))
      .auth(auth(), { type: 'bearer' })
      .send({ token })
      .expect(200);
    const body: unknown = initial.body;
    const data = (body as { data: { authorization: string } }).data;
    expect(initial.headers['cache-control']).toBe('no-store');
    expect(initial.headers['referrer-policy']).toBe('no-referrer');
    expect(await rowCount('attendances', id)).toBe(0);
    const result = await request(app.getHttpServer())
      .post(path(id, 'combined-check-in'))
      .auth(auth(), { type: 'bearer' })
      .send(payload(data.authorization))
      .expect(201);
    expect(result.body).toMatchObject({
      data: { status: 'PRESENT', registrationMethod: 'GEOLOCATION_QR' },
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /authorization|latitude|longitude|tokenHash|token_hash/,
    );
    const mark = await source.getRepository(Attendance).findOneOrFail({
      where: { attendanceSession: { idAttendanceSession: id } },
      relations: { markedBy: true },
    });
    expect(mark.markedBy?.idUser).toBe(2);
    expect(mark.accuracy).toBe('10.00');
    expect(mark.distanceMeters).toBe('0.00');
    const consumed = await source
      .getRepository(AttendanceCombinedAuthorization)
      .findOneByOrFail({ attendanceSession: { idAttendanceSession: id } });
    expect(consumed.consumedAt?.getTime()).toBe(mark.markedAt?.getTime());
    expect(await rowCount('attendance_audit_events', id)).toBe(1);
    expect(
      (await academicAttendanceCounts(source.getRepository(Attendance), 1, [2], new Date()))[0]
        .present,
    ).toBeGreaterThanOrEqual(0);
    await api.closeSession(1, id);
    const own = await request(app.getHttpServer())
      .get(path(id, 'qr-own-mark'))
      .auth(auth(), { type: 'bearer' })
      .expect(200);
    expect(own.body).toMatchObject({
      data: { ownMark: { status: 'PRESENT', registrationMethod: 'GEOLOCATION_QR' } },
    });
    await rejectCode(api.combinedCheckIn(2, id, payload(data.authorization)), 'SESSION_CLOSED');
  });
  it('issues unique canonical secrets, persists only SHA-256 and replaces the previous secret', async () => {
    const id = await open();
    const first = await authorization(id);
    const second = await authorization(id);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
    expect(Buffer.from(first, 'base64url').toString('base64url')).toBe(first);
    const rows: unknown = await source.query(
      'SELECT token_hash,qr_validated_at,expires_at FROM attendance_combined_authorizations WHERE id_attendance_session=$1',
      [id],
    );
    const row = (rows as { token_hash: Buffer; qr_validated_at: Date; expires_at: Date }[])[0];
    expect(row.token_hash).toEqual(createHash('sha256').update(second, 'ascii').digest());
    expect(row.expires_at.getTime() - row.qr_validated_at.getTime()).toBe(90000);
    expect(await rowCount('attendance_combined_authorizations', id)).toBe(1);
    await rejectCode(api.combinedCheckIn(2, id, payload(first)), 'COMBINED_AUTHORIZATION_INVALID');
    await api.combinedCheckIn(2, id, payload(second));
    await rejectCode(api.combinedCheckIn(2, id, payload(second)), 'ALREADY_REGISTERED');
    const repeated = await challenge(id);
    expect(repeated.authorization).toBeNull();
    expect(repeated.ownMark?.registrationMethod).toBe('GEOLOCATION_QR');
  });
  it('caps expiry by session end and binds authorization to student and session', async () => {
    const id = await open();
    // A valid minute-or-longer session near expiry, without creating a sub-minute session.
    const earlier = new Date(Date.now() - 60000);
    await source.query(
      'UPDATE attendance_sessions SET starts_at=$2,opened_at=$2,date=$3,ends_at=$4 WHERE id_attendance_session=$1',
      [id, earlier, attendanceAcademicDate(earlier), new Date(Date.now() + 30000)],
    );
    const initial = await challenge(id);
    expect(initial.authorizationExpiresAt).toEqual((await loaded(id)).endsAt);
    const other = await open();
    await rejectCode(
      api.combinedCheckIn(3, id, payload(initial.authorization!)),
      'COMBINED_AUTHORIZATION_INVALID',
    );
    await rejectCode(
      api.combinedCheckIn(2, other, payload(initial.authorization!)),
      'COMBINED_AUTHORIZATION_INVALID',
    );
    await source.query(
      `UPDATE attendance_combined_authorizations SET qr_validated_at=now()-interval '91 seconds',expires_at=now()-interval '1 second' WHERE id_attendance_session=$1`,
      [id],
    );
    await rejectCode(
      api.combinedCheckIn(2, id, payload(initial.authorization!)),
      'COMBINED_AUTHORIZATION_EXPIRED',
    );
    expect(await rowCount('attendances', id)).toBe(0);
  });
  it.each([1, 4, 5, 6, 7])(
    'rejects noneligible authenticated user %s including SUPERADMIN without enrollment',
    async (user) => {
      const id = await open();
      const token = (await api.getQr(1, id)).token;
      await request(app.getHttpServer())
        .post(path(id, 'combined-challenge'))
        .auth(auth(user, [], ['SUPERADMIN']), { type: 'bearer' })
        .send({ token })
        .expect(403);
      expect(await rowCount('attendance_combined_authorizations', id)).toBe(0);
    },
  );
  it('rejects missing permission, revoked JWT session, inactive enrollment and academic context', async () => {
    const id = await open();
    const token = (await api.getQr(1, id)).token;
    await request(app.getHttpServer())
      .post(path(id, 'combined-challenge'))
      .send({ token })
      .expect(401);
    await request(app.getHttpServer())
      .post(path(id, 'combined-challenge'))
      .auth(auth(2, ['attendance.check-in']), { type: 'bearer' })
      .send({ token })
      .expect(403);
    await source.query('UPDATE user_sessions SET is_active=false WHERE id_session=2');
    try {
      await request(app.getHttpServer())
        .post(path(id, 'combined-challenge'))
        .auth(auth(), { type: 'bearer' })
        .send({ token })
        .expect(401);
    } finally {
      await source.query('UPDATE user_sessions SET is_active=true WHERE id_session=2');
    }
    await source.query('UPDATE enrollments SET is_active=false WHERE id_enrollment=2');
    try {
      await rejectCode(api.combinedChallenge(2, id, { token }), 'NOT_ENROLLED');
    } finally {
      await source.query('UPDATE enrollments SET is_active=true WHERE id_enrollment=2');
    }
    await source.query('UPDATE courses SET is_active=false WHERE id_course=1');
    try {
      await rejectCode(api.combinedChallenge(2, id, { token }), 'SESSION_CONTEXT_INVALID');
    } finally {
      await source.query('UPDATE courses SET is_active=true WHERE id_course=1');
    }
  });
  it('rejects invalid, expired and cross-session QR without reserving attendance', async () => {
    const id = await open();
    const other = await open();
    const token = (await api.getQr(1, id)).token;
    await rejectCode(api.combinedChallenge(2, other, { token }), 'QR_TOKEN_INVALID');
    await rejectCode(api.combinedChallenge(2, id, { token: 'invalid' }), 'QR_TOKEN_INVALID');
    await source.query(
      `UPDATE attendance_sessions SET starts_at=$2,opened_at=$2,date=$3 WHERE id_attendance_session=$1`,
      [id, new Date(Date.now() - 60000), attendanceAcademicDate(new Date(Date.now() - 60000))],
    );
    const session = await loaded(id);
    const stale = tokens.issue(session, new Date(Date.now() - 40000)).token;
    await rejectCode(api.combinedChallenge(2, id, { token: stale }), 'QR_TOKEN_EXPIRED');
    expect(await rowCount('attendances', id)).toBe(0);
  });
  it.each([
    'userId',
    'enrollmentId',
    'status',
    'markedAt',
    'markedBy',
    'distanceMeters',
    'registrationMethod',
  ])('rejects injected field %s and redacts secret query from errors', async (field) => {
    const id = await open();
    const nonce = await authorization(id);
    const result = await request(app.getHttpServer())
      .post(path(id, 'combined-check-in') + '?authorization=synthetic-private')
      .auth(auth(), { type: 'bearer' })
      .send({ ...payload(nonce), [field]: 'injected' })
      .expect(400);
    expect(JSON.stringify(result.body)).not.toContain(nonce);
    expect(JSON.stringify(result.body)).not.toContain('synthetic-private');
    expect(result.headers['cache-control']).toBe('no-store');
    expect(await rowCount('attendances', id)).toBe(0);
  });
  it.each([
    [{ latitude: 91 }, 'LOCATION_INVALID'],
    [{ longitude: -181 }, 'LOCATION_INVALID'],
    [{ accuracy: -1 }, 'LOCATION_INVALID'],
    [{ accuracy: 50.001 }, 'LOW_ACCURACY'],
    [{ latitude: -19.58 }, 'OUTSIDE_AREA'],
    [{ latitude: NaN }, 'LOCATION_INVALID'],
    [{ accuracy: Infinity }, 'LOCATION_INVALID'],
  ])('rejects invalid GPS %j without consuming authorization', async (values, expected) => {
    const id = await open();
    const nonce = await authorization(id);
    await rejectCode(api.combinedCheckIn(2, id, { ...payload(nonce), ...values }), expected);
    expect(await rowCount('attendances', id)).toBe(0);
    expect(
      (
        await source
          .getRepository(AttendanceCombinedAuthorization)
          .findOneByOrFail({ attendanceSession: { idAttendanceSession: id } })
      ).consumedAt,
    ).toBeNull();
  });
  it.each(['', 'x'.repeat(42), '='.repeat(43), 'A'.repeat(42) + 'B'])(
    'rejects malformed/noncanonical authorization',
    async (nonce) => {
      const id = await open();
      await rejectCode(
        api.combinedCheckIn(2, id, payload(nonce)),
        'COMBINED_AUTHORIZATION_INVALID',
      );
    },
  );
  it.each(['PRESENT', 'EXCUSED', 'ABSENT'] as const)(
    'persists manual %s with individual reason, actor and CREATE event',
    async (status) => {
      const id = await open();
      const [mark] = await api.saveAttendances(1, id, {
        attendances: [
          {
            enrollmentId: 2,
            status: status as Status,
            observation: 'Verified personally in class',
          },
        ],
      });
      expect(mark.status).toBe(status);
      expect(mark.registrationMethod).toBe('MANUAL');
      expect(mark.observation).toBe('Verified personally in class');
      expect(mark.markedBy?.idUser).toBe(1);
      expect(await rowCount('attendance_audit_events', id)).toBe(1);
      expect((await challenge(id)).authorization).toBeNull();
      await rejectCode(api.combinedCheckIn(2, id, payload('A'.repeat(43))), 'ALREADY_REGISTERED');
    },
  );
  it.each([
    null,
    '',
    '   ',
    '\u200b'.repeat(20),
    '\u034f'.repeat(20),
    '!!!!!!!!!!!',
    'short',
    'x'.repeat(501),
  ])('rejects empty/invisible/invalid manual reason', async (observation) => {
    const id = await open();
    await rejectCode(
      api.saveAttendances(1, id, {
        attendances: [{ enrollmentId: 2, status: Status.PRESENT, observation }],
      }),
      'MANUAL_REASON_REQUIRED',
    );
    expect(await rowCount('attendances', id)).toBe(0);
  });
  it('audits corrections after closure, preserves reasons in roster and restricts history to the owner', async () => {
    const id = await open();
    await api.saveAttendances(1, id, {
      attendances: [
        { enrollmentId: 2, status: Status.PRESENT, observation: 'Verified personally in class' },
      ],
    });
    await api.closeSession(1, id);
    await api.saveAttendances(1, id, {
      attendances: [
        {
          enrollmentId: 2,
          status: Status.EXCUSED,
          observation: 'Correction after checking attendance',
        },
      ],
    });
    const audit = await api.getAttendanceAudit(1, id, {});
    expect(audit.data).toHaveLength(2);
    expect(audit.data[1]).toMatchObject({
      operation: 'UPDATE',
      previousStatus: 'PRESENT',
      newStatus: 'EXCUSED',
      previousObservation: 'Verified personally in class',
      newObservation: 'Correction after checking attendance',
      idActor: 1,
      sessionStateAtOperation: 'CLOSED',
    });
    const roster = await api.getSessionPage(1, id, {});
    expect(roster.data.attendances[0].observation).toBe('Correction after checking attendance');
    await request(app.getHttpServer())
      .get(path(id, 'audit'))
      .auth(assistant(), { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(path(id, 'audit'))
      .auth(auth(), { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get(path(id, 'audit'))
      .auth(auth(6, assistantPermissions, ['SUPERADMIN']), { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(path(id, 'audit'))
      .auth(assistant(), { type: 'bearer' })
      .send({})
      .expect(404);
    await expect(api.deleteAttendance(1, id, 2)).rejects.toThrow();
    await source.query('UPDATE users SET is_active=false WHERE id_user=1');
    try {
      await request(app.getHttpServer())
        .get(path(id, 'audit'))
        .auth(assistant(), { type: 'bearer' })
        .expect(403);
    } finally {
      await source.query('UPDATE users SET is_active=true WHERE id_user=1');
    }
  });
  it('rejects markAll, duplicate IDs, invalid batches, student/foreign-owner contingencies and untracked manual corrections', async () => {
    const id = await open();
    const record = {
      enrollmentId: 2,
      status: Status.PRESENT,
      observation: 'Verified personally in class',
    };
    await rejectCode(
      api.saveAttendances(1, id, { markAll: Status.PRESENT, attendances: [] }),
      'MANUAL_OVERRIDE_FORBIDDEN',
    );
    await rejectCode(
      api.saveAttendances(1, id, { attendances: [record, record] }),
      'MANUAL_OVERRIDE_FORBIDDEN',
    );
    await rejectCode(
      api.saveAttendances(1, id, { attendances: Array.from({ length: 101 }, () => record) }),
      'MANUAL_OVERRIDE_FORBIDDEN',
    );
    await request(app.getHttpServer())
      .post(`/api/attendances/sessions/${id}`)
      .auth(auth(), { type: 'bearer' })
      .send({ attendances: [record] })
      .expect(403);
    await expect(api.saveAttendances(6, id, { attendances: [record] })).rejects.toThrow();
    await source.query(
      `INSERT INTO attendances(id_attendance_session,id_enrollment,status) VALUES($1,2,'PRESENT')`,
      [id],
    );
    await rejectCode(
      api.saveAttendances(1, id, { attendances: [record] }),
      'MANUAL_OVERRIDE_FORBIDDEN',
    );
  });
  it.each(['DRAFT', 'SCHEDULED', 'CANCELLED'])('rejects contingency in %s', async (state) => {
    const id = await open({
      activate: state === 'SCHEDULED',
      starts: state === 'SCHEDULED' ? new Date(Date.now() + 60000) : undefined,
    });
    if (state === 'CANCELLED') await api.cancelSession(1, id);
    await rejectCode(
      api.saveAttendances(1, id, {
        attendances: [
          { enrollmentId: 2, status: Status.PRESENT, observation: 'Verified personally in class' },
        ],
      }),
      'MANUAL_OVERRIDE_FORBIDDEN',
    );
  });
  it.each(['GEOLOCATION', 'QR', 'GEOLOCATION_QR'])(
    'never overwrites %s evidence',
    async (method) => {
      const id = await open();
      await source.query(
        `INSERT INTO attendances(id_attendance_session,id_enrollment,status,registration_method,id_marked_by,marked_at,accuracy,distance_meters)
      VALUES($1,2,'PRESENT',$2,2,now(),$3,$4)`,
        [id, method, method === 'QR' ? null : 10, method === 'QR' ? null : 0],
      );
      await rejectCode(
        api.saveAttendances(1, id, {
          attendances: [
            { enrollmentId: 2, status: Status.ABSENT, observation: 'Attempted manual replacement' },
          ],
        }),
        'ATTENDANCE_EVIDENCE_PROTECTED',
      );
      await expect(api.deleteAttendance(1, id, 2)).rejects.toThrow();
    },
  );
  it.each(['attendances', 'attendance_combined_authorizations', 'attendance_audit_events'])(
    'rolls back mark, consumption and audit when %s fails',
    async (table) => {
      const id = await open();
      const nonce = await authorization(id);
      await source.query(
        `CREATE FUNCTION public.comb3_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic COMB failure'; END $$`,
      );
      await source.query(
        `CREATE TRIGGER comb3_fault BEFORE ${table === 'attendance_combined_authorizations' ? 'UPDATE' : 'INSERT'} ON ${table} FOR EACH ROW EXECUTE FUNCTION public.comb3_fault()`,
      );
      try {
        await expect(api.combinedCheckIn(2, id, payload(nonce))).rejects.toThrow(
          'synthetic COMB failure',
        );
      } finally {
        await source.query(`DROP TRIGGER comb3_fault ON ${table}`);
        await source.query('DROP FUNCTION public.comb3_fault()');
      }
      expect(await rowCount('attendances', id)).toBe(0);
      expect(await rowCount('attendance_audit_events', id)).toBe(0);
      expect(
        (
          await source
            .getRepository(AttendanceCombinedAuthorization)
            .findOneByOrFail({ attendanceSession: { idAttendanceSession: id } })
        ).consumedAt,
      ).toBeNull();
      await api.combinedCheckIn(2, id, payload(nonce));
    },
  );
  it('rolls back an entire manual batch when a later student is invalid', async () => {
    const id = await open();
    await rejectCode(
      api.saveAttendances(1, id, {
        attendances: [
          { enrollmentId: 2, status: Status.ABSENT, observation: 'Verified personally in class' },
          { enrollmentId: 4, status: Status.PRESENT, observation: 'Wrong course must reject all' },
        ],
      }),
      'NOT_ENROLLED',
    );
    expect(await rowCount('attendances', id)).toBe(0);
    expect(await rowCount('attendance_audit_events', id)).toBe(0);
  });
  it('serializes double check-in and simultaneous challenges per student', async () => {
    const id = await open();
    const token = (await api.getQr(1, id)).token;
    const attempts = await Promise.all([
      api.combinedChallenge(2, id, { token }),
      api.combinedChallenge(2, id, { token }),
    ]);
    const rows: unknown = await source.query(
      'SELECT token_hash FROM attendance_combined_authorizations WHERE id_attendance_session=$1',
      [id],
    );
    const hash = (rows as { token_hash: Buffer }[])[0].token_hash;
    const current = attempts.find((result) =>
      createHash('sha256').update(result.authorization!, 'ascii').digest().equals(hash),
    )!;
    const invalid = attempts.find((result) => result !== current)!;
    await rejectCode(
      api.combinedCheckIn(2, id, payload(invalid.authorization!)),
      'COMBINED_AUTHORIZATION_INVALID',
    );
    const results = await Promise.allSettled([
      api.combinedCheckIn(2, id, payload(current.authorization!)),
      api.combinedCheckIn(2, id, payload(current.authorization!)),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await rowCount('attendances', id)).toBe(1);
    expect(await rowCount('attendance_audit_events', id)).toBe(1);
  });
  it('allows two students to use the same QR without global token consumption', async () => {
    const id = await open();
    const token = (await api.getQr(1, id)).token;
    const results = await Promise.all([
      api.combinedChallenge(2, id, { token }),
      api.combinedChallenge(3, id, { token }),
    ]);
    await Promise.all(
      results.map((result, index) =>
        api.combinedCheckIn(index + 2, id, payload(result.authorization!)),
      ),
    );
    expect(await rowCount('attendances', id)).toBe(2);
  });
  it('rejects challenge and check-in when close wins the session lock', async () => {
    const id = await open();
    const nonce = await authorization(id);
    const token = (await api.getQr(1, id)).token;
    const blocker = await held(id);
    const close = api.closeSession(1, id);
    await waitForWaiter();
    const check = api.combinedCheckIn(2, id, payload(nonce)).catch((error) => code(error));
    const next = api.combinedChallenge(3, id, { token }).catch((error) => code(error));
    await blocker.commitTransaction();
    await blocker.release();
    await close;
    expect(await check).toBe('SESSION_CLOSED');
    expect(await next).toBe('SESSION_CLOSED');
    expect(await rowCount('attendances', id)).toBe(0);
  });
  it('rejects authorization that expires while waiting for the session lock', async () => {
    const id = await open();
    const nonce = await authorization(id);
    await source.query(
      `UPDATE attendance_combined_authorizations SET qr_validated_at=now()-interval '89 seconds',expires_at=now()+interval '1 second' WHERE id_attendance_session=$1`,
      [id],
    );
    const blocker = await held(id);
    const attempt = api.combinedCheckIn(2, id, payload(nonce)).catch((error) => code(error));
    await waitForWaiter();
    await delay(1100);
    await blocker.commitTransaction();
    await blocker.release();
    expect(await attempt).toBe('COMBINED_AUTHORIZATION_EXPIRED');
    expect(await rowCount('attendances', id)).toBe(0);
  });
  it('serializes check-in, manual save, markAll and reconfiguration without changing evidence', async () => {
    const id = await open();
    const nonce = await authorization(id);
    const results = await Promise.allSettled([
      api.combinedCheckIn(2, id, payload(nonce)),
      api.saveAttendances(1, id, {
        attendances: [
          { enrollmentId: 2, status: Status.PRESENT, observation: 'Verified personally in class' },
        ],
      }),
      api.saveAttendances(1, id, { markAll: Status.PRESENT, attendances: [] }),
      api.configureGeolocation(1, id, { radiusMeters: 500 }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await rowCount('attendances', id)).toBe(1);
    expect(await rowCount('attendance_audit_events', id)).toBe(1);
    expect((await loaded(id)).radiusMeters).toBe(100);
  });
  it('reconciles a real lost HTTP response after commit without repeating the write', async () => {
    const id = await open();
    const nonce = await authorization(id);
    const lost = await request(app.getHttpServer())
      .post(path(id, 'combined-check-in'))
      .auth(auth(), { type: 'bearer' })
      .set('x-comb-drop-response', '1')
      .send(payload(nonce))
      .then(
        () => false,
        () => true,
      );
    expect(lost).toBe(true);
    expect(await rowCount('attendances', id)).toBe(1);
    expect((await api.getQrOwnMark(2, id)).ownMark).toMatchObject({
      status: 'PRESENT',
      registrationMethod: 'GEOLOCATION_QR',
    });
  });
  it('counts two same-day sessions independently on closure, including explicit and implicit absence', async () => {
    const first = await open();
    const second = await open();
    const student = 3;
    const before = await academicAttendanceCounts(
      source.getRepository(Attendance),
      1,
      [student],
      new Date(),
    );
    for (const id of [first, second])
      await api.combinedCheckIn(student, id, payload(await authorization(id, student)));
    const stillOpen = await academicAttendanceCounts(
      source.getRepository(Attendance),
      1,
      [student],
      new Date(),
    );
    expect(stillOpen).toEqual(before);
    await api.closeSession(1, first);
    let after = (
      await academicAttendanceCounts(source.getRepository(Attendance), 1, [student], new Date())
    )[0];
    expect(after.total).toBe(before[0].total + 1);
    expect(after.present).toBe(before[0].present + 1);
    await api.closeSession(1, second);
    after = (
      await academicAttendanceCounts(source.getRepository(Attendance), 1, [student], new Date())
    )[0];
    expect(after.total).toBe(before[0].total + 2);
    expect(after.present).toBe(before[0].present + 2);
    expect(isAttendanceSessionComputable(await loaded(second), new Date())).toBe(true);
    const snapshot = (
      await academicAttendanceCounts(source.getRepository(Attendance), 1, [2], new Date())
    )[0];
    await api.saveAttendances(1, first, {
      attendances: [
        {
          enrollmentId: 2,
          status: Status.ABSENT,
          observation: 'Verified absent from first session',
        },
      ],
    });
    expect(
      (await academicAttendanceCounts(source.getRepository(Attendance), 1, [2], new Date()))[0],
    ).toEqual(snapshot);
  });

  it('accepts an individual authorization after the original QR has expired, without extending its TTL', async () => {
    const id = await open();
    const token = (await api.getQr(1, id)).token;
    const initial = await api.combinedChallenge(2, id, { token });
    const qrSession = await loaded(id);
    jest.useFakeTimers({
      now: Date.now() + 40000,
      doNotFake: [
        'nextTick',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'performance',
        'queueMicrotask',
        'hrtime',
      ],
    });
    try {
      expect(() =>
        tokens.validatePeriod(tokens.verify(token, id), qrSession, new Date()),
      ).toThrow();
      await api.combinedCheckIn(2, id, payload(initial.authorization!));
    } finally {
      jest.useRealTimers();
    }
    const row = await source
      .getRepository(AttendanceCombinedAuthorization)
      .findOneByOrFail({ attendanceSession: { idAttendanceSession: id } });
    expect(row.expiresAt).toEqual(initial.authorizationExpiresAt);
    expect(row.consumedAt).not.toBeNull();
  });
  it('rejects a QR that expires while its challenge waits for the session lock', async () => {
    const id = await open();
    const token = (await api.getQr(1, id)).token;
    const blocker = await held(id);
    const attempt = api.combinedChallenge(2, id, { token }).catch((error) => code(error));
    await waitForWaiter();
    jest.useFakeTimers({
      now: Date.now() + 40000,
      doNotFake: [
        'nextTick',
        'setTimeout',
        'clearTimeout',
        'setInterval',
        'clearInterval',
        'setImmediate',
        'clearImmediate',
        'performance',
        'queueMicrotask',
        'hrtime',
      ],
    });
    try {
      await blocker.commitTransaction();
      await blocker.release();
      expect(await attempt).toBe('QR_TOKEN_EXPIRED');
    } finally {
      jest.useRealTimers();
    }
    expect(await rowCount('attendance_combined_authorizations', id)).toBe(0);
    expect(await rowCount('attendances', id)).toBe(0);
  });
  it('serializes renewal against confirmation without creating a partial mark', async () => {
    const id = await open();
    const nonce = await authorization(id);
    const token = (await api.getQr(1, id)).token;
    const [renewal, confirmation] = await Promise.allSettled([
      api.combinedChallenge(2, id, { token }),
      api.combinedCheckIn(2, id, payload(nonce)),
    ]);
    expect(renewal.status).toBe('fulfilled');
    if (confirmation.status === 'rejected') {
      expect(code(confirmation.reason)).toBe('COMBINED_AUTHORIZATION_INVALID');
      if (renewal.status === 'fulfilled')
        await api.combinedCheckIn(2, id, payload(renewal.value.authorization!));
    }
    expect(await rowCount('attendances', id)).toBe(1);
    expect(await rowCount('attendance_audit_events', id)).toBe(1);
  });
  it('rejects deletion of an externally inconsistent draft with authorization artifacts', async () => {
    const draft = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.GEOLOCATION_QR,
    });
    const authorizations = source.getRepository(AttendanceCombinedAuthorization);
    await authorizations.save({
      attendanceSession: { idAttendanceSession: draft.idAttendanceSession },
      studentEnrollment: { idEnrollment: 2 },
      tokenHash: Buffer.alloc(32, 99),
      qrValidatedAt: new Date(),
      expiresAt: new Date(Date.now() + 90000),
      consumedAt: null,
    });
    await expect(api.deleteSession(1, draft.idAttendanceSession)).rejects.toThrow(
      'SESSION_HAS_ATTENDANCE',
    );
    expect(await loaded(draft.idAttendanceSession)).toBeDefined();
  });
  it('rolls back a manual contingency if its audit insertion fails', async () => {
    const id = await open();
    await source.query(
      `CREATE FUNCTION public.comb3_manual_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic manual audit failure'; END $$`,
    );
    await source.query(
      'CREATE TRIGGER comb3_manual_fault BEFORE INSERT ON attendance_audit_events FOR EACH ROW EXECUTE FUNCTION public.comb3_manual_fault()',
    );
    try {
      await expect(
        api.saveAttendances(1, id, {
          attendances: [
            {
              enrollmentId: 2,
              status: Status.ABSENT,
              observation: 'Verified personally in classroom',
            },
          ],
        }),
      ).rejects.toThrow('synthetic manual audit failure');
    } finally {
      await source.query('DROP TRIGGER comb3_manual_fault ON attendance_audit_events');
      await source.query('DROP FUNCTION public.comb3_manual_fault()');
    }
    expect(await rowCount('attendances', id)).toBe(0);
    expect(await rowCount('attendance_audit_events', id)).toBe(0);
  });
  it('distinguishes explicit ABSENT from unmarked pending students in OPEN roster and history', async () => {
    const id = await open();
    await api.saveAttendances(1, id, {
      attendances: [
        { enrollmentId: 2, status: Status.ABSENT, observation: 'Verified absent from classroom' },
      ],
    });
    const roster = await api.getSessionPage(1, id, {});
    expect(roster.data.absentCount).toBe(1);
    expect(roster.data.pendingCount).toBe(1);
    expect(roster.data.attendances[0].observation).toBe('Verified absent from classroom');
    const history = await api.getSessionsPage(1, 1, { page: 1, limit: 100 });
    expect(history.data.find((row) => row.idAttendanceSession === id)).toMatchObject({
      absentCount: 1,
      pendingCount: 1,
      isComputable: false,
    });
    await api.closeSession(1, id);
    const closed = await api.getSessionPage(1, id, {});
    expect(closed.data.absentCount).toBe(2);
    expect(closed.data.pendingCount).toBe(0);
  });
  it('serializes the same authorization across two independent backend processes', async () => {
    const id = await open();
    const nonce = await authorization(id);
    const identity: unknown = await source.query(
      "SELECT current_setting('data_directory') AS directory",
    );
    const directory = (identity as { directory: string }[])[0].directory;
    const worker = () =>
      new Promise<string>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            '-r',
            'ts-node/register',
            '-r',
            'tsconfig-paths/register',
            'test/attendance-combined-worker.ts',
          ],
          { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
        );
        let output = '';
        let error = '';
        const timeout = setTimeout(() => {
          child.kill();
          reject(new Error('Isolated worker timeout'));
        }, 50000);
        child.stdout.on('data', (chunk: Buffer) => {
          output += chunk.toString();
        });
        child.stderr.on('data', (chunk: Buffer) => {
          error += chunk.toString();
        });
        child.on('error', (err) => {
          clearTimeout(timeout);
          reject(err);
        });
        child.on('exit', (code) => {
          clearTimeout(timeout);
          if (code === 0) resolve(output);
          else reject(new Error(error));
        });
        child.stdin.end(
          JSON.stringify({ port: database.port, directory, id, authorization: nonce }),
        );
      });
    expect((await Promise.all([worker(), worker()])).sort()).toEqual([
      'ALREADY_REGISTERED',
      'SUCCESS',
    ]);
    expect(await rowCount('attendances', id)).toBe(1);
    expect(await rowCount('attendance_audit_events', id)).toBe(1);
  }, 60000);
});
