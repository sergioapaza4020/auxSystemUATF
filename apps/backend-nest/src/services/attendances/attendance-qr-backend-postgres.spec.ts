import { Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AttendancesService } from './attendances.service';
import { AttendanceQrTokenService } from './attendance-qr-token.service';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceStatus as Status } from '@common/enums/attendanceStatus';
import { AttendanceRegistrationMethod as Method } from '@common/enums/attendanceRegistrationMethod';
import {
  attendanceAcademicDate,
  getAttendanceSessionState,
} from '@common/utils/attendance-session-policy';
import { academicAttendanceCounts } from '@common/utils/attendance-academic-counts';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { SessionsService } from 'src/services/sessions/sessions.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { SemestersService } from '../semesters/semesters.service';
import { User } from 'src/entities/users/users.entity';
import { Course } from 'src/entities/courses/courses.entity';
import { Semester } from 'src/entities/semesters/semester.entity';
import { CourseRelations } from '@common/enums/courseRelations';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
const describePostgres = pgBin ? describe : describe.skip;

describePostgres('QR backend with signed JWT and verified disposable PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let api: AttendancesService;
  let tokens: AttendanceQrTokenService;
  let app: INestApplication<Server>;
  const jwtSecret = 'qr-http-test-only-signing-key';
  const jwt = new JwtService();
  const auth = (idUser = 2, permissions = ['attendance.qr.check-in'], roles = ['STUDENT']) =>
    jwt.sign({ idUser, idSession: 1, permissions, roles }, { secret: jwtSecret, expiresIn: 120 });
  const assistantAuth = () =>
    auth(
      1,
      [
        'attendance.qr.get',
        'attendance.session.create',
        'attendance.session.update',
        'attendance.session.delete',
        'attendance.save',
      ],
      ['ASSISTANT'],
    );
  const path = (id: number, operation: string) => `/api/attendances/sessions/${id}/${operation}`;
  const loaded = (id: number) =>
    source.getRepository(AttendanceSession).findOneByOrFail({ idAttendanceSession: id });

  async function open(starts = new Date(Date.now() - 60000), ends = new Date(Date.now() + 600000)) {
    const session = await api.createSession(1, {
      enrollmentId: 1,
      mode: Mode.QR,
      date: attendanceAcademicDate(starts),
    });
    await api.configureQr(1, session.idAttendanceSession, {
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
    });
    await api.activateSession(1, session.idAttendanceSession, starts <= new Date());
    return session.idAttendanceSession;
  }
  beforeAll(async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_SECRET: jwtSecret,
      ATTENDANCE_QR_ACTIVE_KID: 'integration',
      ATTENDANCE_QR_KEYS_JSON: JSON.stringify({
        integration: Buffer.alloc(32, 7).toString('base64'),
      }),
    });
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    await source.runMigrations({ transaction: 'each' });
    await source.query(`INSERT INTO users (id_user, email, username, password, name, lastname, ci)
      SELECT n, 'qr' || n || '@test.invalid', 'qr' || n, 'unused', 'Test', 'User', 'qr' || n FROM generate_series(1,5) n`);
    await source.query(
      `INSERT INTO courses (id_course, name, code, "group") VALUES (1,'QR course','QR1',1), (2,'Other','QR2',1)`,
    );
    const year = new Date().getUTCFullYear();
    await source.query(
      `INSERT INTO semesters (id_semester, year, semester_number, start_date, end_date)
      VALUES (1,$1,'II',$2,$3), (2,$1,'I',$2,$3)`,
      [year, new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year + 1, 0, 1))],
    );
    await source.query(`INSERT INTO enrollments (id_enrollment, id_user, id_course, id_semester, role)
      VALUES (1,1,1,1,'ASSISTANT'), (2,2,1,1,'STUDENT'), (3,3,1,1,'STUDENT'), (4,4,2,1,'STUDENT'), (5,5,1,2,'STUDENT')`);
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
          useValue: { assertActiveSession: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  }, 90000);
  beforeEach(async () => {
    if (!source?.isInitialized) return;
    await source.query('DELETE FROM attendances');
    await source.query('DELETE FROM attendance_sessions');
    await source.query('UPDATE enrollments SET is_active = true');
  });
  afterAll(async () => {
    await app?.close();
    await database?.close();
    jest.restoreAllMocks();
  }, 45000);

  it('enables COMB creation while rejecting all historical self-registration bypasses', async () => {
    await request(app.getHttpServer())
      .post('/api/attendances/sessions')
      .auth(assistantAuth(), { type: 'bearer' })
      .send({ enrollmentId: 1, date: attendanceAcademicDate(new Date()), mode: 'GEOLOCATION_QR' })
      .expect(201);
    await expect(
      api.createSession(1, {
        enrollmentId: 1,
        date: attendanceAcademicDate(new Date()),
        mode: Mode.GEOLOCATION_QR,
      }),
    ).resolves.toMatchObject({ mode: Mode.GEOLOCATION_QR });
    const session = await source.getRepository(AttendanceSession).save({
      assistantEnrollment: { idEnrollment: 1 },
      date: attendanceAcademicDate(new Date()) as unknown as Date,
      mode: Mode.GEOLOCATION_QR,
    });
    const id = session.idAttendanceSession;
    const tokenSession = Object.assign(new AttendanceSession(), session, {
      mode: Mode.QR,
      startsAt: new Date(Date.now() - 60000),
      endsAt: new Date(Date.now() + 60000),
      openedAt: new Date(Date.now() - 60000),
    });
    const token = tokens.issue(tokenSession, new Date()).token;
    for (const operation of ['qr-context', 'qr-check-in']) {
      await request(app.getHttpServer())
        .post(path(id, operation))
        .auth(auth(), { type: 'bearer' })
        .send({ token })
        .expect(409);
    }
    await request(app.getHttpServer())
      .post(path(id, 'check-in'))
      .auth(auth(2, ['attendance.check-in']), { type: 'bearer' })
      .send({ latitude: -19.57, longitude: -65.75, accuracy: 10 })
      .expect(409);
    await request(app.getHttpServer())
      .get(path(id, 'qr'))
      .auth(assistantAuth(), { type: 'bearer' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/api/attendances/sessions/${id}`)
      .auth(assistantAuth(), { type: 'bearer' })
      .send({
        attendances: [{ enrollmentId: 2, status: 'PRESENT', observation: 'Verified in classroom' }],
      })
      .expect(409);
    expect(await source.getRepository(Attendance).count()).toBe(0);
    expect(await source.query('SELECT 1 FROM attendance_combined_authorizations')).toEqual([]);
  });

  it('enforces the Bolivia POST date and opens every self-registration mode for exactly the requested minute', async () => {
    const past = attendanceAcademicDate(new Date(Date.now() - 86400000));
    for (const mode of [Mode.MANUAL, Mode.GEOLOCATION, Mode.QR, Mode.GEOLOCATION_QR])
      await request(app.getHttpServer())
        .post('/api/attendances/sessions')
        .auth(assistantAuth(), { type: 'bearer' })
        .send({ enrollmentId: 1, date: past, mode })
        .expect(400);
    for (const mode of [Mode.GEOLOCATION, Mode.QR, Mode.GEOLOCATION_QR]) {
      const draft = await api.createSession(1, {
        enrollmentId: 1,
        date: attendanceAcademicDate(new Date()),
        mode,
      });
      const id = draft.idAttendanceSession;
      if (mode !== Mode.QR)
        await api.configureGeolocation(1, id, {
          latitude: -19.57,
          longitude: -65.75,
          radiusMeters: 100,
          maximumAcceptedAccuracy: 50,
        });
      for (const durationMinutes of [0, -1, 1.5, 'abc', null, Number.MAX_SAFE_INTEGER])
        await request(app.getHttpServer())
          .patch(path(id, 'open-now'))
          .auth(assistantAuth(), { type: 'bearer' })
          .send({ durationMinutes })
          .expect(400);
      const before = Date.now();
      await request(app.getHttpServer())
        .patch(path(id, 'open-now'))
        .auth(assistantAuth(), { type: 'bearer' })
        .send({
          durationMinutes: 1,
          startsAt: '2000-01-01T00:00:00Z',
          endsAt: '2099-01-01T00:00:00Z',
        })
        .expect(200);
      const saved = await loaded(id);
      expect(saved.startsAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(saved.startsAt!.getTime()).toBeLessThanOrEqual(Date.now());
      expect(saved.openedAt).toEqual(saved.startsAt);
      expect(saved.endsAt!.getTime() - saved.startsAt!.getTime()).toBe(60000);
      expect(getAttendanceSessionState(saved, saved.endsAt!)).toBe('CLOSED');
      if (mode === Mode.GEOLOCATION_QR) {
        const issued = await api.getQr(1, id);
        const authorization = await api.combinedChallenge(2, id, { token: issued.token });
        expect(authorization.authorizationExpiresAt!.getTime()).toBeLessThanOrEqual(
          saved.endsAt!.getTime(),
        );
        await source.query(
          'DELETE FROM attendance_combined_authorizations WHERE id_attendance_session=$1',
          [id],
        );
      }
    }
  });

  it('completes HTTP create/configure/activate/issue/context/confirm/own-mark/close without exposing others', async () => {
    const create = await request(app.getHttpServer())
      .post('/api/attendances/sessions')
      .auth(assistantAuth(), { type: 'bearer' })
      .send({ enrollmentId: 1, date: attendanceAcademicDate(new Date()), mode: 'QR' })
      .expect(201);
    const body: unknown = create.body;
    const id = (body as { data: { idAttendanceSession: number } }).data.idAttendanceSession;
    expect(create.body).toMatchObject({
      data: { mode: 'QR', state: 'DRAFT', isComputable: false },
    });
    await request(app.getHttpServer())
      .patch(path(id, 'qr'))
      .auth(assistantAuth(), { type: 'bearer' })
      .send({
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 600000).toISOString(),
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(path(id, 'open-now'))
      .auth(assistantAuth(), { type: 'bearer' })
      .expect(200);
    const emitted = await request(app.getHttpServer())
      .get(path(id, 'qr'))
      .auth(assistantAuth(), { type: 'bearer' })
      .expect(200);
    const emittedBody: unknown = emitted.body;
    const token = (emittedBody as { data: { token: string } }).data.token;
    expect(emitted.headers['cache-control']).toBe('no-store');
    const context = await request(app.getHttpServer())
      .post(path(id, 'qr-context'))
      .auth(auth(), { type: 'bearer' })
      .send({ token })
      .expect(200);
    expect(context.body).toMatchObject({
      data: { course: { name: 'QR course', group: 1 }, state: 'OPEN', ownMark: null },
    });
    expect(await source.getRepository(Attendance).count()).toBe(0);
    const confirmed = await request(app.getHttpServer())
      .post(path(id, 'qr-check-in'))
      .auth(auth(2, ['attendance.qr.check-in'], ['ASSISTANT', 'STUDENT']), { type: 'bearer' })
      .send({ token })
      .expect(201);
    expect(confirmed.body).toMatchObject({
      data: { code: 'SUCCESS', status: 'PRESENT', registrationMethod: 'QR' },
    });
    expect(confirmed.headers['cache-control']).toBe('no-store');
    const [record] = await source
      .getRepository(Attendance)
      .find({ relations: { markedBy: true, enrollment: true } });
    expect(record).toMatchObject({
      markedBy: { idUser: 2 },
      enrollment: { idEnrollment: 2 },
      accuracy: null,
      distanceMeters: null,
    });
    await request(app.getHttpServer())
      .patch(path(id, 'close'))
      .auth(assistantAuth(), { type: 'bearer' })
      .expect(200);
    const own = await request(app.getHttpServer())
      .get(path(id, 'qr-own-mark'))
      .auth(auth(), { type: 'bearer' })
      .expect(200);
    expect(own.body).toMatchObject({
      data: { ownMark: { status: 'PRESENT', registrationMethod: 'QR' } },
    });
    expect(JSON.stringify(own.body)).not.toMatch(
      /token|latitude|longitude|enrollment|password|roles|permissions|Test/,
    );
    await request(app.getHttpServer())
      .post(path(id, 'qr-check-in'))
      .auth(auth(3), { type: 'bearer' })
      .send({ token })
      .expect(409);
  });

  it.each(['qr', 'qr-own-mark', 'qr-context', 'qr-check-in'])(
    'requires signed JWT and the correct distinct permission for %s',
    async (operation) => {
      const id = await open();
      const call = () =>
        ['qr', 'qr-own-mark'].includes(operation)
          ? request(app.getHttpServer()).get(path(id, operation))
          : request(app.getHttpServer()).post(path(id, operation)).send({ token: 'invalid' });
      await call().expect(401);
      await call()
        .auth(auth(2, ['attendance.check-in']), { type: 'bearer' })
        .expect(403);
      if (operation === 'qr') await call().auth(auth(), { type: 'bearer' }).expect(403);
    },
  );

  it.each(['enrollmentId', 'userId', 'status', 'markedAt', 'markedBy', 'registrationMethod'])(
    'rejects extra %s at HTTP without persisting',
    async (field) => {
      const id = await open();
      const { token } = await api.getQr(1, id);
      for (const operation of ['qr-context', 'qr-check-in']) {
        const response = await request(app.getHttpServer())
          .post(path(id, operation))
          .auth(auth(), { type: 'bearer' })
          .send({ token, [field]: 99 })
          .expect(400);
        expect(response.body).toMatchObject({ code: 'QR_TOKEN_INVALID' });
        expect(JSON.stringify(response.body)).not.toContain(token);
      }
      expect(await source.getRepository(Attendance).count()).toBe(0);
    },
  );

  it.each([
    {},
    { startsAt: '2026-11-12T13:00:00' },
    { startsAt: 'not-a-date', endsAt: 'not-a-date' },
    { startsAt: '2026-W46-4T13:00:00Z', endsAt: '2026-W46-4T14:00:00Z' },
    { startsAt: '2026-315T13:00:00Z', endsAt: '2026-315T14:00:00Z' },
    { startsAt: '2026-11-12T14:00:00Z', endsAt: '2026-11-12T13:00:00Z' },
    { startsAt: '2099-11-12T13:00:00Z', endsAt: '2099-11-12T14:00:00Z' },
    {
      startsAt: '2026-11-12T13:00:00Z',
      endsAt: '2026-11-12T14:00:00Z',
      openedAt: '2026-11-12T13:00:00Z',
    },
  ])('rejects invalid or injected QR config %#', async (body) => {
    const session = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.QR,
    });
    await request(app.getHttpServer())
      .patch(path(session.idAttendanceSession, 'qr'))
      .auth(assistantAuth(), { type: 'bearer' })
      .send(body)
      .expect(400);
    expect((await loaded(session.idAttendanceSession)).openedAt).toBeNull();
  });

  it('keeps MANUAL available when QR keys are missing and returns 503 for QR alone', async () => {
    const id = await open();
    const previous = process.env.ATTENDANCE_QR_KEYS_JSON;
    try {
      process.env.ATTENDANCE_QR_KEYS_JSON = '{}';
      const unavailable = new AttendancesService(
        source.getRepository(AttendanceSession),
        source.getRepository(Attendance),
        source.getRepository(Enrollment),
        new AttendanceQrTokenService(),
      );
      await expect(unavailable.getQr(1, id)).rejects.toMatchObject({
        status: 503,
        response: { code: 'QR_NOT_AVAILABLE' },
      });
      const tomorrow = attendanceAcademicDate(new Date(Date.now() + 86400000));
      expect((await unavailable.createSession(1, { enrollmentId: 1, date: tomorrow })).mode).toBe(
        Mode.MANUAL,
      );
    } finally {
      process.env.ATTENDANCE_QR_KEYS_JSON = previous;
    }
  });

  it.each([Method.GEOLOCATION, Method.QR])(
    'preserves existing protected %s against a repeated QR attempt',
    async (method) => {
      const id = await open();
      const { token } = await api.getQr(1, id);
      const recordRepository = source.getRepository(Attendance);
      await recordRepository.save({
        attendanceSession: { idAttendanceSession: id },
        enrollment: { idEnrollment: 2 },
        status: Status.PRESENT,
        registrationMethod: method,
        markedAt: new Date(),
        markedBy: { idUser: 2 },
        accuracy: method === Method.GEOLOCATION ? '1' : null,
        distanceMeters: method === Method.GEOLOCATION ? '0' : null,
      });
      await expect(api.checkInQr(2, id, { token })).rejects.toMatchObject({
        response: { code: 'ALREADY_REGISTERED' },
      });
      expect((await source.getRepository(Attendance).find())[0].registrationMethod).toBe(method);
    },
  );

  it('serializes open-now against cancellation and retains the winning terminal transition', async () => {
    const draft = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.QR,
    });
    const id = draft.idAttendanceSession;
    await api.configureQr(1, id, {
      startsAt: new Date(Date.now() + 60000).toISOString(),
      endsAt: new Date(Date.now() + 120000).toISOString(),
    });
    const results = await Promise.allSettled([
      api.activateSession(1, id, true),
      api.cancelSession(1, id),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(['OPEN', 'CANCELLED']).toContain(
      getAttendanceSessionState(await loaded(id), new Date()),
    );
  });

  it('does not reflect token query parameters in errors and disables caching on errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/attendances/sessions/invalid/qr-check-in?token=must-not-leak')
      .auth(auth(), { type: 'bearer' })
      .send({ token: 'x' })
      .expect(400);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(JSON.stringify(response.body)).not.toContain('must-not-leak');
  });

  it.each([0, -1, 2147483648, 999999999999])(
    'rejects out-of-range QR session id %i before querying PostgreSQL',
    async (id) => {
      const response = await request(app.getHttpServer())
        .get(path(id, 'qr-own-mark'))
        .auth(auth(), { type: 'bearer' })
        .expect(400);
      expect(response.body).toMatchObject({ code: 'QR_TOKEN_INVALID' });
    },
  );

  it.each([4, 5, 1])(
    'rejects user %i with another course/semester or no STUDENT enrollment',
    async (user) => {
      const id = await open();
      const { token } = await api.getQr(1, id);
      await expect(api.checkInQr(user, id, { token })).rejects.toMatchObject({
        response: { code: 'NOT_ENROLLED' },
      });
    },
  );
  it('enforces active enrollment, ownership, and SUPERADMIN academic validation', async () => {
    const id = await open();
    const { token } = await api.getQr(1, id);
    await expect(api.getQr(2, id)).rejects.toThrow('No tienes permisos');
    await source.query('UPDATE enrollments SET is_active = false WHERE id_enrollment=2');
    await expect(api.checkInQr(2, id, { token })).rejects.toMatchObject({
      response: { code: 'NOT_ENROLLED' },
    });
    await request(app.getHttpServer())
      .post(path(id, 'qr-check-in'))
      .auth(auth(4, [], ['SUPERADMIN']), { type: 'bearer' })
      .send({ token })
      .expect(403);
  });

  it('programs, freezes, cancels, opens now, and deletes only an empty draft', async () => {
    let draft = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.QR,
    });
    await api.deleteSession(1, draft.idAttendanceSession);
    draft = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.QR,
    });
    const id = draft.idAttendanceSession;
    const config = {
      startsAt: new Date(Date.now() + 60000).toISOString(),
      endsAt: new Date(Date.now() + 120000).toISOString(),
    };
    await api.configureQr(1, id, config);
    expect(await api.activateSession(1, id)).toMatchObject({ state: 'SCHEDULED' });
    await expect(api.configureQr(1, id, config)).rejects.toThrow('SESSION_ALREADY_ACTIVATED');
    await expect(api.updateSession(1, id, { date: '2026-01-01' })).rejects.toThrow();
    await expect(api.getQr(1, id)).rejects.toMatchObject({
      response: { code: 'SESSION_NOT_STARTED' },
    });
    await api.cancelSession(1, id);
    await expect(api.deleteSession(1, id)).rejects.toThrow('SESSION_CANNOT_DELETE');
    await source.query('DELETE FROM attendance_sessions');
    const fresh = await api.createSession(1, {
      enrollmentId: 1,
      date: attendanceAcademicDate(new Date()),
      mode: Mode.QR,
    });
    await api.configureQr(1, fresh.idAttendanceSession, config);
    expect(await api.activateSession(1, fresh.idAttendanceSession, true)).toMatchObject({
      state: 'OPEN',
    });
    await expect(api.cancelSession(1, fresh.idAttendanceSession)).rejects.toThrow(
      'SESSION_CANNOT_CANCEL',
    );
  });

  it.each([Status.PRESENT, Status.EXCUSED, Status.ABSENT])(
    'preserves a prior MANUAL %s instead of upserting',
    async (status) => {
      const id = await open();
      const { token } = await api.getQr(1, id);
      const recordRepository = source.getRepository(Attendance);
      await recordRepository.save({
        attendanceSession: { idAttendanceSession: id },
        enrollment: { idEnrollment: 2 },
        status,
        registrationMethod: Method.MANUAL,
      });
      await expect(api.checkInQr(2, id, { token })).rejects.toMatchObject({
        response: { code: 'ALREADY_REGISTERED' },
      });
      expect(await source.getRepository(Attendance).count()).toBe(1);
    },
  );

  it('serializes double check-in and allows other students to use the same QR', async () => {
    const id = await open();
    const { token } = await api.getQr(1, id);
    const results = await Promise.allSettled([
      api.checkInQr(2, id, { token }),
      api.checkInQr(2, id, { token }),
      api.checkInQr(3, id, { token }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    const failure = results.find((r) => r.status === 'rejected');
    expect(failure).toMatchObject({ reason: { response: { code: 'ALREADY_REGISTERED' } } });
    expect(await source.getRepository(Attendance).count()).toBe(2);
    await expect(
      api.saveAttendances(1, id, { attendances: [], markAll: Status.ABSENT }),
    ).rejects.toThrow();
    await expect(api.deleteAttendance(1, id, 2)).rejects.toThrow();
  });

  it.each(['close', 'markAll', 'manual'])(
    'preserves a consistent winner in check-in versus %s',
    async (operation) => {
      const id = await open();
      const { token } = await api.getQr(1, id);
      await Promise.allSettled([
        api.checkInQr(2, id, { token }),
        operation === 'close'
          ? api.closeSession(1, id)
          : operation === 'markAll'
            ? api.saveAttendances(1, id, { attendances: [], markAll: Status.PRESENT })
            : api.saveAttendances(1, id, {
                attendances: [{ enrollmentId: 2, status: Status.EXCUSED }],
              }),
      ]);
      const records = await source
        .getRepository(Attendance)
        .find({ where: { enrollment: { idEnrollment: 2 } } });
      expect(records.length).toBeLessThanOrEqual(1);
      if (operation === 'markAll' || operation === 'manual') {
        expect(records).toHaveLength(1);
        expect([Method.QR, Method.MANUAL]).toContain(records[0].registrationMethod);
      } else expect(getAttendanceSessionState(await loaded(id), new Date())).toBe('CLOSED');
    },
  );

  it('never accepts an emitted token after a concurrent close', async () => {
    const id = await open();
    const results = await Promise.allSettled([api.getQr(1, id), api.closeSession(1, id)]);
    if (results[0].status === 'fulfilled')
      await expect(api.checkInQr(2, id, { token: results[0].value.token })).rejects.toMatchObject({
        response: { code: 'SESSION_CLOSED' },
      });
    expect(getAttendanceSessionState(await loaded(id), new Date())).toBe('CLOSED');
    await expect(api.getQr(1, id)).rejects.toThrow();
    expect(await source.getRepository(Attendance).count()).toBe(0);
  });

  it('rejects an in-flight token if a close wins the session lock', async () => {
    const id = await open();
    const { token } = await api.getQr(1, id);
    const runner = source.createQueryRunner();
    await runner.startTransaction();
    try {
      await runner.manager
        .getRepository(AttendanceSession)
        .findOne({ where: { idAttendanceSession: id }, lock: { mode: 'pessimistic_write' } });
      const attempt = api.checkInQr(2, id, { token });
      const result = Promise.allSettled([attempt]);
      await runner.query(
        'UPDATE attendance_sessions SET closed_at=$1 WHERE id_attendance_session=$2',
        [new Date(), id],
      );
      await runner.commitTransaction();
      expect(await result).toMatchObject([
        { status: 'rejected', reason: { response: { code: 'SESSION_CLOSED' } } },
      ]);
      expect(await source.getRepository(Attendance).count()).toBe(0);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('does not count OPEN marks, consolidates implicit absence and EXCUSED only at closure', async () => {
    const id = await open();
    const { token } = await api.getQr(1, id);
    await api.checkInQr(2, id, { token });
    expect(await api.getMyStudentAttendance(2, 2)).toMatchObject({
      totalSessions: 0,
      presentSessions: 0,
      percentage: 0,
    });
    expect((await api.getSessionPage(1, id, { page: 1, limit: 10 })).data).toMatchObject({
      pendingCount: 1,
      absentCount: 0,
    });
    await api.closeSession(1, id);
    expect(await api.getMyStudentAttendance(2, 2)).toMatchObject({
      totalSessions: 1,
      presentSessions: 1,
      percentage: 100,
    });
    expect(await api.getMyStudentAttendance(3, 3)).toMatchObject({
      totalSessions: 1,
      absentSessions: 1,
    });
    await api.saveAttendances(1, id, {
      attendances: [
        { enrollmentId: 3, status: Status.EXCUSED, observation: 'Authorized exception' },
      ],
    });
    expect(await api.getMyStudentAttendance(3, 3)).toMatchObject({
      totalSessions: 1,
      excusedSessions: 1,
      percentage: 100,
    });
    expect(
      await academicAttendanceCounts(source.getRepository(Attendance), 1, [2, 3], new Date()),
    ).toEqual([
      { enrollmentId: 2, total: 1, present: 1, excused: 0 },
      { enrollmentId: 3, total: 1, present: 0, excused: 1 },
    ]);
  });

  it('serializes reassignment against QR creation using the owner enrollment row', async () => {
    const enrollmentApi = new EnrollmentsService(
      source.getRepository(Enrollment),
      {
        getOneByUsername: async () => ({
          ...(await source.getRepository(User).findOneByOrFail({ idUser: 1 })),
          roles: [{ name: 'ASSISTANT' }],
        }),
      } as unknown as UsersService,
      {
        getOneByPeriodYear: async () =>
          source.getRepository(Semester).findOneByOrFail({ idSemester: 1 }),
      } as unknown as SemestersService,
      {
        getOneByCode: async () => source.getRepository(Course).findOneByOrFail({ idCourse: 2 }),
      } as unknown as CoursesService,
    );
    const results = await Promise.allSettled([
      api.createSession(1, {
        enrollmentId: 1,
        date: attendanceAcademicDate(new Date()),
        mode: Mode.QR,
      }),
      enrollmentApi.update(1, { courseCode: 'QR2', role: CourseRelations.ASSISTANT }),
    ]);
    const owner = await source
      .getRepository(Enrollment)
      .findOneOrFail({ where: { idEnrollment: 1 }, relations: { course: true } });
    const creation = results[0];
    if (creation.status === 'fulfilled')
      expect(creation.value.assistantEnrollment.course.idCourse).toBe(owner.course.idCourse);
    await source.query('UPDATE enrollments SET id_course=1 WHERE id_enrollment=1');
  });

  it('uses a single academic snapshot while closure races the aggregate', async () => {
    const id = await open();
    const { token } = await api.getQr(1, id);
    await api.checkInQr(2, id, { token });
    const reading = Array.from({ length: 12 }, () =>
      academicAttendanceCounts(source.getRepository(Attendance), 1, [2], new Date()),
    );
    await api.closeSession(1, id);
    const results = await Promise.all(reading);
    for (const [row] of results) {
      expect((row.total === 0 && row.present === 0) || (row.total === 1 && row.present === 1)).toBe(
        true,
      );
    }
  });

  it('does not enumerate a session through own-mark for an unrelated student', async () => {
    const id = await open();
    for (const target of [id, 2147483647]) {
      const response = await request(app.getHttpServer())
        .get(path(target, 'qr-own-mark'))
        .auth(auth(4), { type: 'bearer' })
        .expect(403);
      expect(response.body).toMatchObject({ code: 'NOT_ENROLLED' });
      expect(response.body).not.toHaveProperty('data');
    }
  });

  it('checks the period again after lock wait while the session remains OPEN', async () => {
    const id = await open();
    const { token, expiresAt } = await api.getQr(1, id);
    const runner = source.createQueryRunner();
    await runner.startTransaction();
    try {
      await runner.query(
        'SELECT 1 FROM attendance_sessions WHERE id_attendance_session=$1 FOR UPDATE',
        [id],
      );
      const pending = Promise.allSettled([api.checkInQr(2, id, { token })]);
      await delay(Math.max(0, expiresAt.getTime() - Date.now()) + 20);
      await runner.commitTransaction();
      expect(await pending).toMatchObject([
        { status: 'rejected', reason: { response: { code: 'QR_TOKEN_EXPIRED' } } },
      ]);
      expect(await source.getRepository(Attendance).count()).toBe(0);
      expect(getAttendanceSessionState(await loaded(id), new Date())).toBe('OPEN');
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  }, 45000);

  it('rejects expiry after waiting under the session lock rather than using arrival time', async () => {
    // Force a short remaining session window. The signed code cannot outlive it.
    const id = await open();
    const earlier = new Date(Date.now() - 60000);
    await source.query(
      'UPDATE attendance_sessions SET starts_at=$2,opened_at=$2,date=$3,ends_at=$4 WHERE id_attendance_session=$1',
      [id, earlier, attendanceAcademicDate(earlier), new Date(Date.now() + 1800)],
    );
    const { token } = await api.getQr(1, id);
    const runner = source.createQueryRunner();
    await runner.startTransaction();
    try {
      await runner.query(
        'SELECT 1 FROM attendance_sessions WHERE id_attendance_session=$1 FOR UPDATE',
        [id],
      );
      const pending = Promise.allSettled([api.checkInQr(2, id, { token })]);
      await delay(1900);
      await runner.commitTransaction();
      expect(await pending).toMatchObject([
        { status: 'rejected', reason: { response: { code: 'SESSION_CLOSED' } } },
      ]);
      expect(await source.getRepository(Attendance).count()).toBe(0);
    } finally {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
