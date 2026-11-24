import type { Request, Response, NextFunction } from 'express';
import { Queue } from 'bullmq';
import { AttendanceRateLimitService } from './attendance-rate-limit.service';
import { AttendanceRateLimitInterceptor } from './attendance-rate-limit.interceptor';
import { Server } from 'node:http';
import { performance } from 'node:perf_hooks';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AuthController } from 'src/controllers/auth/auth.controller';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { SessionsService } from '../sessions/sessions.service';
import { RolesService } from '../roles/roles.service';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { AttendancesService } from './attendances.service';
import { AttendanceQrTokenService } from './attendance-qr-token.service';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { User } from 'src/entities/users/users.entity';
import { UserSession } from 'src/entities/user-sessions/user-sessions.entity';
import { Role } from 'src/entities/roles/roles.entity';
import { Permission } from 'src/entities/permissions/permissions.entity';
import { JwtStrategy } from '@core/strategies/jwt/jwt.strategy';
import { JwtAuthGuard } from '@core/guards/auth/auth.guard';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { httpCorsOptions } from '@core/config/http-cors.config';
import { attendanceAcademicDate } from '@common/utils/attendance-session-policy';

function data(response: { body: unknown }): Record<string, unknown> {
  const body = response.body;
  if (
    !body ||
    typeof body !== 'object' ||
    !('data' in body) ||
    !body.data ||
    typeof body.data !== 'object' ||
    Array.isArray(body.data)
  )
    throw new Error('Invalid HTTP contract');
  return body.data as Record<string, unknown>;
}

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
const isolated = pgBin ? describe : describe.skip;
type LoadResult = {
  students: number;
  successes: number;
  errors: number;
  duplicates: number;
  p50Ms: number;
  p95Ms: number;
  totalMs: number;
};

isolated('COMB-6 real HTTP login, combined flow and disposable PostgreSQL', () => {
  let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
  let source: DataSource;
  let app: INestApplication<Server>;
  let assistant: string;
  const students: string[] = [];
  const metrics: LoadResult[] = [];
  let current: number | null = null;
  let done = false;
  const password = 'synthetic-comb6-fixture-password';
  const login = async (username: string) => {
    const result = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(201);
    return data(result) as { accessToken: string; refreshToken: string };
  };
  const path = (id: number, operation: string) => `/api/attendances/sessions/${id}/${operation}`;
  const proof = async (id: number, token: string, jwt: string) => {
    await request(app.getHttpServer())
      .post(path(id, 'qr-context'))
      .auth(jwt, { type: 'bearer' })
      .send({ token })
      .expect(200);
    const response = await request(app.getHttpServer())
      .post(path(id, 'combined-challenge'))
      .auth(jwt, { type: 'bearer' })
      .send({ token })
      .expect(200);
    expect(data(response).mode).toBe('GEOLOCATION_QR');
    return {
      authorization: String(data(response).authorization),
      latitude: -19.57,
      longitude: -65.75,
      accuracy: 10,
    };
  };
  const create = async () => {
    const result = await request(app.getHttpServer())
      .post('/api/attendances/sessions')
      .auth(assistant, { type: 'bearer' })
      .send({ enrollmentId: 1, date: attendanceAcademicDate(new Date()), mode: 'GEOLOCATION_QR' })
      .expect(201);
    const id = Number(data(result).idAttendanceSession);
    await request(app.getHttpServer())
      .patch(path(id, 'geolocation'))
      .auth(assistant, { type: 'bearer' })
      .send({
        latitude: -19.57,
        longitude: -65.75,
        radiusMeters: 100,
        maximumAcceptedAccuracy: 50,
        startsAt: new Date(Date.now() + 60000).toISOString(),
        endsAt: new Date(Date.now() + 600000).toISOString(),
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(path(id, 'open-now'))
      .auth(assistant, { type: 'bearer' })
      .send({ durationMinutes: 10 })
      .expect(200);
    return id;
  };
  beforeAll(async () => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      JWT_ACCESS_SECRET: 'comb6-synthetic-access-signing-key',
      JWT_ACCESS_REFRESH: 'comb6-synthetic-refresh-signing-key',
      JWT_ACCESS_SECRET_EXPIRES_IN: '15m',
      JWT_ACCESS_REFRESH_EXPIRES_IN: '7d',
      ATTENDANCE_QR_ACTIVE_KID: 'fixture',
      ATTENDANCE_QR_KEYS_JSON: JSON.stringify({
        fixture: Buffer.alloc(32, 0x17).toString('base64'),
      }),
    });
    database = await createSeedTestDatabase(pgBin!);
    source = database.source;
    await source.runMigrations({ transaction: 'each' });
    const hash = await bcrypt.hash(password, 10);
    await source.query(
      `INSERT INTO users (id_user,email,username,password,name,lastname,ci)
      SELECT n,'comb6-'||n||'@test.invalid','comb6-'||n,$1,'Synthetic','Fixture','comb6-'||n FROM generate_series(1,51) n`,
      [hash],
    );
    await source.query(
      `INSERT INTO courses (id_course,name,code,"group") VALUES (1,'Synthetic COMB6 course','COMB6',1)`,
    );
    const year = new Date().getUTCFullYear();
    await source.query(
      `INSERT INTO semesters (id_semester,year,semester_number,start_date,end_date) VALUES (1,$1,'II',$2,$3)`,
      [year, new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year + 1, 0, 1))],
    );
    await source.query(
      `INSERT INTO enrollments (id_enrollment,id_user,id_course,id_semester,role) SELECT n,n,1,1,CASE WHEN n=1 THEN 'ASSISTANT' ELSE 'STUDENT' END::enrollments_role_enum FROM generate_series(1,51) n`,
    );
    const permissions = await source
      .getRepository(Permission)
      .save(
        [
          'attendance.session.create',
          'attendance.session.update',
          'attendance.session.get-one',
          'attendance.qr.get',
          'attendance.save',
          'attendance.qr.check-in',
          'enrollment.get-my-enrollment',
        ].map((name) => ({ name })),
      );
    const ownerRole = await source.getRepository(Role).save({
      name: 'ASSISTANT',
      permissions: permissions.filter(
        (p) => !['attendance.qr.check-in', 'enrollment.get-my-enrollment'].includes(p.name),
      ),
    });
    const studentRole = await source.getRepository(Role).save({
      name: 'STUDENT',
      permissions: permissions.filter((p) =>
        ['attendance.qr.check-in', 'enrollment.get-my-enrollment'].includes(p.name),
      ),
    });
    for (let id = 1; id <= 51; id++)
      await source
        .createQueryBuilder()
        .relation(User, 'roles')
        .of(id)
        .add(id === 1 ? ownerRole.idRole : studentRole.idRole);
    const api = new AttendancesService(
      source.getRepository(AttendanceSession),
      source.getRepository(Attendance),
      source.getRepository(Enrollment),
      new AttendanceQrTokenService(),
    );
    const module = await Test.createTestingModule({
      controllers: [AuthController, AttendancesController],
      providers: [
        AuthService,
        UsersService,
        SessionsService,
        JwtService,
        JwtStrategy,
        { provide: AttendancesService, useValue: api },
        { provide: getRepositoryToken(User), useValue: source.getRepository(User) },
        { provide: getRepositoryToken(UserSession), useValue: source.getRepository(UserSession) },
        // Unused administrative/import dependencies: authentication and repositories are real.
        { provide: RolesService, useValue: {} },
        { provide: BulkOperationsService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.setGlobalPrefix('api');
    // Test-only fault injection: destroy the socket after the real handler has committed.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['x-comb6-drop-response'] === '1')
        res.json = () => {
          res.destroy();
          return res;
        };
      next();
    });
    app.useGlobalGuards(new JwtAuthGuard(new Reflector()), new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalFilters(new HttpExceptionFilter());
    // Unit store model at the Redis boundary; Lua/real distributed Redis remains a separate integration gate.
    const counters = new Map<string, number>();
    const quota = new AttendanceRateLimitService({
      client: Promise.resolve({
        defineCommand: () => undefined,
        runCommand: (_name: string, args: [string, number]) => {
          const n = (counters.get(args[0]) ?? 0) + 1;
          counters.set(args[0], n);
          return [n, 60000];
        },
      }),
    } as unknown as Queue);
    app.useGlobalInterceptors(new AttendanceRateLimitInterceptor(quota), new ResponseInterceptor());
    if (process.env.COMB6_BROWSER_E2E === '1') {
      const adapter = app.getHttpAdapter();
      adapter.get('/__comb6/scan', async (_req: Request, res: Response) => {
        current = await create();
        const emitted = await request(app.getHttpServer())
          .get(path(current, 'qr'))
          .auth(assistant, { type: 'bearer' })
          .expect(200);
        const token = String(data(emitted).token);
        res
          .type('html')
          .send(
            `<h1>COMB6 · ensayo aislado</h1><a href="http://127.0.0.1:4300/attendance/qr#t=${encodeURIComponent(token)}">Escanear QR de prueba</a>`,
          );
      });
      adapter.get('/__comb6/status', async (_req: Request, res: Response) => {
        const marks = current
          ? await source
              .getRepository(Attendance)
              .countBy({ attendanceSession: { idAttendanceSession: current } })
          : 0;
        res.json({ fixture: 'COMB6_ISOLATED', pid: process.pid, marks });
      });
      adapter.post('/__comb6/finish', async (_req: Request, res: Response) => {
        if (current) {
          await request(app.getHttpServer())
            .patch(path(current, 'close'))
            .auth(assistant, { type: 'bearer' })
            .expect(200);
        }
        done = true;
        res.json({ fixture: 'COMB6_ISOLATED', closed: true });
      });
    }
    app.enableCors(httpCorsOptions('http://127.0.0.1:4300'));
    await app.listen(0, '127.0.0.1');
    assistant = (await login('comb6-1')).accessToken;
    for (let id = 2; id <= 51; id++) students.push((await login(`comb6-${id}`)).accessToken);
  }, 120000);
  afterAll(async () => {
    await app?.close();
    await database?.close();
    jest.restoreAllMocks();
    if (process.env.COMB6_WRITE_EVIDENCE === '1' && metrics.length) {
      const directory = resolve('../../docs/attendance-comb-6');
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        resolve(directory, 'load-results.json'),
        JSON.stringify(
          {
            executedAt: new Date().toISOString(),
            environment:
              'Real local HTTP login/JWT/COMB + disposable PostgreSQL; synthetic Redis-boundary model and GPS; no production traffic',
            samples: metrics,
          },
          null,
          2,
        ) + '\n',
      );
    }
  }, 45000);
  it('completes login/refresh/create/context/check-in/roster/close/academic summary with real sessions', async () => {
    const account = await login('comb6-2');
    const refresh = await request(app.getHttpServer())
      .post('/api/auth/refresh-access-token')
      .send({ refreshToken: account.refreshToken })
      .expect(201);
    const student = String(data(refresh).accessToken);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .auth(student, { type: 'bearer' })
      .expect(200);
    const id = await create();
    const emitted = await request(app.getHttpServer())
      .get(path(id, 'qr'))
      .auth(assistant, { type: 'bearer' })
      .expect(200);
    const token = String(data(emitted).token);
    await request(app.getHttpServer())
      .post(path(id, 'qr-context'))
      .auth(student, { type: 'bearer' })
      .send({ token })
      .expect(200);
    expect(
      await source
        .getRepository(Attendance)
        .countBy({ attendanceSession: { idAttendanceSession: id } }),
    ).toBe(0);
    const evidence = await proof(id, token, student);
    await request(app.getHttpServer())
      .post(path(id, 'combined-check-in'))
      .auth(student, { type: 'bearer' })
      .send(evidence)
      .expect(201);
    await request(app.getHttpServer())
      .post(path(id, 'combined-check-in'))
      .auth(student, { type: 'bearer' })
      .send(evidence)
      .expect(409);
    const roster = await request(app.getHttpServer())
      .get(`/api/attendances/sessions/${id}`)
      .auth(assistant, { type: 'bearer' })
      .expect(200);
    expect(data(roster).attendances).toHaveLength(1);
    const before = await request(app.getHttpServer())
      .get('/api/attendances/student/my/2')
      .auth(student, { type: 'bearer' })
      .expect(200);
    expect(data(before)).toMatchObject({ totalSessions: 0, presentSessions: 0 });
    await request(app.getHttpServer())
      .patch(path(id, 'close'))
      .auth(assistant, { type: 'bearer' })
      .expect(200);
    const own = await request(app.getHttpServer())
      .get(path(id, 'qr-own-mark'))
      .auth(student, { type: 'bearer' })
      .expect(200);
    expect(data(own).ownMark).toMatchObject({
      status: 'PRESENT',
      registrationMethod: 'GEOLOCATION_QR',
    });
    const summary = await request(app.getHttpServer())
      .get('/api/attendances/student/my/2')
      .auth(student, { type: 'bearer' })
      .expect(200);
    expect(data(summary)).toMatchObject({
      totalSessions: 1,
      presentSessions: 1,
      percentage: 100,
    });
    const sessionId = new JwtService().verify<{ idSession: number }>(student, {
      secret: process.env.JWT_ACCESS_SECRET,
    }).idSession;
    await source.query('UPDATE user_sessions SET is_active=false WHERE id_session=$1', [sessionId]);
    await request(app.getHttpServer())
      .get(path(id, 'qr-own-mark'))
      .auth(student, { type: 'bearer' })
      .expect(401);
  }, 30000);
  it('reconciles a committed POST whose HTTP response is intentionally lost', async () => {
    const id = await create();
    const emitted = await request(app.getHttpServer())
      .get(path(id, 'qr'))
      .auth(assistant, { type: 'bearer' })
      .expect(200);
    const token = String(data(emitted).token);
    const evidence = await proof(id, token, students[0]);
    const lost = await request(app.getHttpServer())
      .post(path(id, 'combined-check-in'))
      .auth(students[0], { type: 'bearer' })
      .set('x-comb6-drop-response', '1')
      .send(evidence)
      .then(
        () => false,
        () => true,
      );
    expect(lost).toBe(true);
    expect(
      await source
        .getRepository(Attendance)
        .countBy({ attendanceSession: { idAttendanceSession: id } }),
    ).toBe(1);
    const own = await request(app.getHttpServer())
      .get(path(id, 'qr-own-mark'))
      .auth(students[0], { type: 'bearer' })
      .expect(200);
    expect(data(own).ownMark).toMatchObject({
      status: 'PRESENT',
      registrationMethod: 'GEOLOCATION_QR',
    });
  });

  it.each([1, 5, 15, 30, 50])(
    'measures %i distinct students using the same token over real HTTP',
    async (size) => {
      const id = await create();
      const remaining = 30000 - (Date.now() % 30000);
      if (remaining < 10000) await delay(remaining + 20);
      const emitted = await request(app.getHttpServer())
        .get(path(id, 'qr'))
        .auth(assistant, { type: 'bearer' })
        .expect(200);
      const token = String(data(emitted).token);
      const start = performance.now();
      const results = await Promise.all(
        students.slice(0, size).map(async (jwt) => {
          const started = performance.now();
          const evidence = await proof(id, token, jwt);
          const result = await request(app.getHttpServer())
            .post(path(id, 'combined-check-in'))
            .auth(jwt, { type: 'bearer' })
            .send(evidence);
          return { status: result.status, ms: performance.now() - started };
        }),
      );
      const sorted = results.map((r) => r.ms).sort((a, b) => a - b);
      const records = await source
        .getRepository(Attendance)
        .countBy({ attendanceSession: { idAttendanceSession: id } });
      const successes = results.filter((r) => r.status === 201).length;
      const metric = {
        requests: size * 3 + 1,
        conflicts: results.filter((r) => r.status === 409).length,
        processRssBytes: process.memoryUsage().rss,
        students: size,
        successes,
        errors: size - successes,
        duplicates: Math.max(0, records - size),
        p50Ms: Number(sorted[Math.ceil(size * 0.5) - 1].toFixed(2)),
        p95Ms: Number(sorted[Math.ceil(size * 0.95) - 1].toFixed(2)),
        totalMs: Number((performance.now() - start).toFixed(2)),
      };
      metrics.push(metric);
      expect(results.map((r) => r.status)).toEqual(Array(size).fill(201));
      expect(records).toBe(size);
    },
    30000,
  );
  const browserTest = process.env.COMB6_BROWSER_E2E === '1' ? it : it.skip;
  browserTest(
    'holds an isolated real API for native browser integration',
    async () => {
      const address = app.getHttpServer().address();
      if (!address || typeof address === 'string') throw new Error('No isolated API port');
      writeFileSync(
        resolve('node_modules/.cache/comb6-browser-ready.json'),
        JSON.stringify({ port: address.port, pid: process.pid }),
      );
      for (let n = 0; !done && n < 2400; n++) await delay(500);
      expect(done).toBe(true);
      expect(
        await source
          .getRepository(Attendance)
          .countBy({ attendanceSession: { idAttendanceSession: current! } }),
      ).toBe(1);
    },
    1250000,
  );
});
