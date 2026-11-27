import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { createSeedTestDatabase } from '../../../test/seeders-postgres';
import { AttendancesService } from './attendances.service';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { attendanceAcademicDate } from '@common/utils/attendance-session-policy';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { AttendanceSessionTopic1796054400000 } from 'src/database/migrations/1796054400000-AttendanceSessionTopic';

interface TopicResponse {
  data: { idAttendanceSession: number; topic: string | null };
}

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
(pgBin ? describe : describe.skip)(
  'Optional session topic with isolated PostgreSQL and HTTP contracts',
  () => {
    let database: Awaited<ReturnType<typeof createSeedTestDatabase>>;
    let api: AttendancesService;
    let app: INestApplication<Server>;
    let legacy: number;
    let user = 1;
    let permissions: string[];
    const today = () => attendanceAcademicDate(new Date());
    beforeAll(async () => {
      database = await createSeedTestDatabase(pgBin!);
      const source = database.source;
      const topicIndex = source.migrations.findIndex(
        (migration) => migration.constructor.name === 'AttendanceSessionTopic1796054400000',
      );
      expect(topicIndex).toBeGreaterThanOrEqual(0);
      const [topicMigration] = source.migrations.splice(topicIndex, 1);
      await source.runMigrations({ transaction: 'each' });
      await source.query(
        `INSERT INTO users(id_user,email,username,password,name,lastname,ci) SELECT n,'topic-'||n||'@test.invalid','topic-'||n,'unused','Synthetic','Fixture','topic-'||n FROM generate_series(1,3)n`,
      );
      await source.query(
        `INSERT INTO courses(id_course,name,code,"group") VALUES(1,'Synthetic topic','TOP',1)`,
      );
      const year = new Date().getUTCFullYear();
      await source.query(
        `INSERT INTO semesters(id_semester,year,semester_number,start_date,end_date) VALUES(1,$1,'II',$2,$3)`,
        [year, new Date(Date.UTC(year - 1, 0, 1)), new Date(Date.UTC(year + 1, 0, 1))],
      );
      await source.query(
        `INSERT INTO enrollments(id_enrollment,id_user,id_course,id_semester,role) VALUES(1,1,1,1,'ASSISTANT'),(2,2,1,1,'STUDENT'),(3,3,1,1,'ASSISTANT')`,
      );
      const rows: { id: number }[] = await source.query(
        `INSERT INTO attendance_sessions(id_assistant_enrollment,date) VALUES(1,$1) RETURNING id_attendance_session AS id`,
        [today()],
      );
      legacy = rows[0].id;
      await source.query(
        `INSERT INTO attendances(id_attendance_session,id_enrollment,status,observation) VALUES($1,2,'EXCUSED','Permiso histórico')`,
        [legacy],
      );
      const history: unknown = await source.query('SELECT * FROM attendances');
      source.migrations.push(topicMigration);
      expect(await source.runMigrations({ transaction: 'each' })).toHaveLength(1);
      expect(await source.query('SELECT * FROM attendances')).toEqual(history);
      expect(await source.query('SELECT topic FROM attendance_sessions')).toEqual([
        { topic: null },
      ]);
      expect(
        (await source.driver.createSchemaBuilder().log()).upQueries.filter((query) =>
          query.query.includes('attendance_sessions'),
        ),
      ).toEqual([]);
      api = new AttendancesService(
        source.getRepository(AttendanceSession),
        source.getRepository(Attendance),
        source.getRepository(Enrollment),
      );
      const module = await Test.createTestingModule({
        controllers: [AttendancesController],
        providers: [{ provide: AttendancesService, useValue: api }],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api');
      app.use((req: Request, _res: Response, next: NextFunction) => {
        Object.assign(req, { user: { idUser: user, roles: ['ASSISTANT'], permissions } });
        next();
      });
      app.useGlobalGuards(new PermissionsGuard(new Reflector()));
      app.useGlobalPipes(createValidationPipe());
      app.useGlobalInterceptors(new ResponseInterceptor());
      app.useGlobalFilters(new HttpExceptionFilter());
      await app.init();
    }, 120000);
    beforeEach(() => {
      user = 1;
      permissions = [
        'attendance.session.create',
        'attendance.session.update',
        'attendance.session.get-one',
      ];
    });
    afterAll(async () => {
      await app?.close();
      await database?.close();
    }, 45000);
    const create = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post('/api/attendances/sessions')
        .send({ enrollmentId: 1, date: today(), ...body });
    const update = (id: number, body: Record<string, unknown>) =>
      request(app.getHttpServer()).patch(`/api/attendances/sessions/${id}/topic`).send(body);
    it.each([Mode.MANUAL, Mode.QR, Mode.GEOLOCATION, Mode.GEOLOCATION_QR])(
      'creates %s with normalized topic and exposes it in owner reads',
      async (mode) => {
        const result = await create({ mode, topic: '  Introducción a Git  ' }).expect(201);
        const id = (result.body as TopicResponse).data.idAttendanceSession;
        expect((result.body as TopicResponse).data.topic).toBe('Introducción a Git');
        const detail = await request(app.getHttpServer())
          .get(`/api/attendances/sessions/${id}`)
          .expect(200);
        expect((detail.body as TopicResponse).data.topic).toBe('Introducción a Git');
      },
    );
    it.each([undefined, null, '', '  ', 'Sin tema'])('stores absent %j as null', async (topic) => {
      const result = await create({ ...(topic !== undefined ? { topic } : {}) }).expect(201);
      expect((result.body as TopicResponse).data.topic).toBeNull();
    });
    it.each(['a'.repeat(256), {}, [], 42])(
      'rejects an invalid topic without inserting: %j',
      async (topic) => {
        const before = await database.source.getRepository(AttendanceSession).count();
        await create({ topic }).expect(400);
        expect(await database.source.getRepository(AttendanceSession).count()).toBe(before);
      },
    );
    it('edits, omits and clears a historical topic without changing marks or configuration', async () => {
      const before: unknown = await database.source.query('SELECT * FROM attendances');
      await update(legacy, { topic: 'Control de versiones' }).expect(200);
      await update(legacy, {}).expect(200);
      expect((await api.getSessionDetail(1, legacy)).topic).toBe('Control de versiones');
      await update(legacy, { topic: '' }).expect(200);
      expect((await api.getSessionDetail(1, legacy)).topic).toBeNull();
      await update(legacy, { topic: null }).expect(200);
      expect(await database.source.query('SELECT * FROM attendances')).toEqual(before);
      await update(legacy, { topic: 'Tema', date: '2099-01-01' }).expect(400);
    });
    it('allows metadata on closed sessions, preserving every other column, even for an inactive semester', async () => {
      const source = database.source;
      const id = ((await create({ mode: Mode.QR })).body as TopicResponse).data.idAttendanceSession;
      const from = new Date(Date.now() - 1000);
      await api.configureQr(1, id, {
        startsAt: from.toISOString(),
        endsAt: new Date(Date.now() + 600000).toISOString(),
      });
      await api.activateSession(1, id, true);
      await api.closeSession(1, id);
      const [before]: Record<string, unknown>[] = await source.query(
        'SELECT * FROM attendance_sessions WHERE id_attendance_session=$1',
        [id],
      );
      await source.query('UPDATE semesters SET is_active=false WHERE id_semester=1');
      try {
        await update(id, { topic: 'Repaso de conceptos' }).expect(200);
      } finally {
        await source.query('UPDATE semesters SET is_active=true WHERE id_semester=1');
      }
      const [after]: Record<string, unknown>[] = await source.query(
        'SELECT * FROM attendance_sessions WHERE id_attendance_session=$1',
        [id],
      );
      expect(after).toEqual({ ...before, topic: 'Repaso de conceptos' });
    });
    it('enforces permission, ownership and cancelled read-only state', async () => {
      permissions = [];
      await update(legacy, { topic: 'No permitido' }).expect(403);
      permissions = ['attendance.session.update'];
      user = 3;
      await update(legacy, { topic: 'Sesión ajena' }).expect(403);
      user = 1;
      const id = (await api.createSession(1, { enrollmentId: 1, date: today(), mode: Mode.QR }))
        .idAttendanceSession;
      await api.cancelSession(1, id);
      await update(id, { topic: 'Cancelada' }).expect(409);
    });
    it('blocks schema rollback while topics exist', async () => {
      const runner = database.source.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await expect(new AttendanceSessionTopic1796054400000().down(runner)).rejects.toThrow(
          'ATTENDANCE_TOPIC_ROLLBACK_BLOCKED',
        );
      } finally {
        await runner.rollbackTransaction();
        await runner.release();
      }
    });
  },
);
