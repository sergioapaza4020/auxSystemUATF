import * as Excel from 'exceljs';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { AttendanceImportController } from 'src/controllers/attendances/attendance-import.controller';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { academicAttendanceCounts } from '@common/utils/attendance-academic-counts';
import { createAcademicTestDatabase } from '../../../test/academic-postgres';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceRegistrationMethod } from '@common/enums/attendanceRegistrationMethod';
import { AttendanceStatus as Status } from '@common/enums/attendanceStatus';
import { attendanceAcademicDate } from '@common/utils/attendance-session-policy';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { AttendanceImportService } from './attendance-import.service';
import { AttendancesService } from './attendances.service';

const pgBin = process.env.ATTENDANCE_TEST_PG_BIN;
(pgBin ? describe : describe.skip)('Importación de asistencia con PostgreSQL desechable', () => {
  let database: Awaited<ReturnType<typeof createAcademicTestDatabase>>;
  let service: AttendanceImportService;
  let attendance: AttendancesService;
  let app: INestApplication;
  const actor: JwtPayload = {
    idUser: 1,
    idSession: 1,
    username: 'academic-1',
    email: 'academic-1@test.invalid',
    roles: ['AUXILIAR'],
    permissions: [
      'attendance.save',
      'attendance.session.create',
      'attendance.session.get-by-enrollment',
      'enrollment.get-students-by-enrollment',
    ],
  };
  const empty = { choices: [], updateExisting: false };
  const newSession = { ...empty, choices: [{ column: 'B', sessionId: 'create' as const }] };
  const day = (offset: number) => attendanceAcademicDate(new Date(Date.now() + offset * 86400000));
  const header = (date: string) => date.split('-').reverse().join('/');

  async function file(
    dates: string[],
    rows: Excel.CellValue[][] = [
      ['0002', 1],
      ['0003', null],
    ],
  ) {
    const book = new Excel.Workbook();
    const sheet = book.addWorksheet('Asistencia');
    sheet.addRow(['RU', ...dates.map(header)]);
    rows.forEach((row) => sheet.addRow(row));
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, originalname: 'asistencia.xlsx', size: buffer.length } as Express.Multer.File;
  }

  beforeAll(async () => {
    database = await createAcademicTestDatabase(pgBin!);
    const { source } = database;
    await source.query(`UPDATE users SET ru = '000' || id_user::text`);
    attendance = new AttendancesService(
      source.getRepository(AttendanceSession),
      source.getRepository(Attendance),
      source.getRepository(Enrollment),
    );
    service = new AttendanceImportService(
      source,
      attendance,
      new BulkOperationsService(
        source.getRepository(BulkOperation),
        source.getRepository(BulkOperationRow),
      ),
    );
    const fixture = await Test.createTestingModule({
      controllers: [AttendanceImportController, AttendancesController],
      providers: [
        { provide: AttendanceImportService, useValue: service },
        { provide: AttendancesService, useValue: attendance },
      ],
    }).compile();
    app = fixture.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, {
        user: req.headers['x-fixture-access'] === 'denied' ? { ...actor, permissions: [] } : actor,
      });
      next();
    });
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.setGlobalPrefix('api');
    await app.init();
  }, 120000);
  afterAll(async () => {
    await app?.close();
    await database?.close();
  }, 45000);

  it('limita plantilla y operación a la matrícula de auxiliar y exige permiso para crear', async () => {
    const book = new Excel.Workbook();
    await book.xlsx.load(new Uint8Array(await service.template(actor, 1)).buffer);
    expect(book.worksheets[0].getColumn(1).values.slice(1)).toEqual(['RU', '0002', '0003']);
    await expect(service.template({ ...actor, idUser: 2 }, 1)).rejects.toThrow();
    const preview = await service.preview(
      {
        ...actor,
        permissions: actor.permissions.filter(
          (permission) => permission !== 'attendance.session.create',
        ),
      },
      1,
      await file([day(1)]),
      newSession,
    );
    expect(preview.operationId).toBeNull();
  });

  it('detecta fechas y RU repetidos, RU ajenos y valores inválidos', async () => {
    const preview = await service.preview(
      actor,
      1,
      await file(
        [day(1), day(1)],
        [
          ['0002', 1, 3],
          ['0002', 'letra', 0],
          ['0004', 0, 2],
          [null, 1, 2],
        ],
      ),
      empty,
    );
    expect(preview.operationId).toBeNull();
    expect(preview.errors.map((error) => error.column + error.row)).toEqual(
      expect.arrayContaining(['B1', 'C1', 'A2', 'A3', 'A4', 'A5', 'C2', 'B3']),
    );
  });

  it('crea solamente al confirmar, registra ausencia explícita y conserva presentes y permisos al omitir', async () => {
    const date = day(2);
    const input = await file(
      [date],
      [
        ['0002', 1],
        ['0003', 2],
      ],
    );
    const prepared = await service.preview(actor, 1, input, empty);
    expect(prepared.operationId).not.toBeNull();
    expect(prepared.columns[0]).toMatchObject({ create: true, allowCreate: true });
    expect(await database.source.getRepository(AttendanceSession).count()).toBe(0);
    await expect(service.confirm(actor, 1, prepared.operationId!)).resolves.toMatchObject({
      created: 2,
      newSessions: 1,
    });
    await expect(service.confirm(actor, 1, prepared.operationId!)).resolves.toMatchObject({
      created: 2,
    });
    const createdSession = await database.source
      .getRepository(AttendanceSession)
      .findOneByOrFail({ date: date as unknown as Date });
    expect(createdSession.topic).toBeNull();
    await attendance.updateSessionTopic(1, createdSession.idAttendanceSession, {
      topic: 'Control de versiones',
    });
    const blanks = await file([date], [['0002'], ['0003']]);
    const skip = await service.preview(actor, 1, blanks, empty);
    expect(skip.cells.map((cell) => cell.previous)).toEqual([Status.PRESENT, Status.EXCUSED]);
    await expect(service.confirm(actor, 1, skip.operationId!)).resolves.toMatchObject({
      skipped: 2,
      empty: 2,
    });
    const update = await service.preview(actor, 1, blanks, { ...empty, updateExisting: true });
    expect(update.warnings).toHaveLength(1);
    await expect(service.confirm(actor, 1, update.operationId!)).resolves.toMatchObject({
      updated: 2,
      absent: 2,
    });
    const session = await database.source
      .getRepository(AttendanceSession)
      .findOneByOrFail({ idAttendanceSession: update.columns[0].selected!.id });
    const detail = await attendance.getSessionDetail(1, session.idAttendanceSession);
    expect(detail.attendances.map((mark) => mark.status)).toEqual([Status.ABSENT, Status.ABSENT]);
    expect(detail.topic).toBe('Control de versiones');
  });

  it('bloquea historial QR y combinado, y resuelve varias sesiones manuales por fecha', async () => {
    for (const [offset, mode] of [
      [3, Mode.QR],
      [4, Mode.GEOLOCATION_QR],
    ] as const) {
      const date = day(offset);
      await attendance.createSession(1, { enrollmentId: 1, date, mode });
      const preview = await service.preview(actor, 1, await file([date]), empty);
      expect(preview.operationId).toBeNull();
      expect(preview.columns[0].candidates[0]).toMatchObject({ mode, editable: false });
    }
    const date = day(5);
    const chosen = await attendance.createSession(1, { enrollmentId: 1, date });
    await attendance.createSession(1, { enrollmentId: 1, date });
    const input = await file([date]);
    const unresolved = await service.preview(actor, 1, input, empty);
    expect(unresolved.operationId).toBeNull();
    expect(unresolved.columns[0].candidates).toHaveLength(2);
    const resolved = await service.preview(actor, 1, input, {
      ...empty,
      choices: [{ column: 'B', sessionId: chosen.idAttendanceSession }],
    });
    await expect(service.confirm(actor, 1, resolved.operationId!)).resolves.toMatchObject({
      created: 2,
      absent: 1,
    });
    expect(
      await database.source.getRepository(Attendance).countBy({
        attendanceSession: { idAttendanceSession: chosen.idAttendanceSession },
        status: Status.ABSENT,
      }),
    ).toBe(1);
  });

  it('revalida marcas, revierte una sesión si falla su escritura y admite reintento', async () => {
    const date = day(6);
    const input = await file([date]);
    const prepared = await service.preview(actor, 1, input, newSession);
    const fail = jest
      .spyOn(attendance, 'saveAttendances')
      .mockRejectedValueOnce(new Error('fallo sintético'));
    try {
      await expect(service.confirm(actor, 1, prepared.operationId!)).rejects.toThrow(
        'fallo sintético',
      );
    } finally {
      fail.mockRestore();
    }
    expect((await service.preview(actor, 1, input, empty)).columns[0].candidates).toHaveLength(0);
    await service.confirm(actor, 1, prepared.operationId!);
    const stale = await service.preview(actor, 1, input, { ...empty, updateExisting: true });
    await attendance.saveAttendances(1, stale.columns[0].selected!.id, {
      attendances: [{ enrollmentId: 2, status: Status.EXCUSED }],
    });
    await expect(service.confirm(actor, 1, stale.operationId!)).rejects.toThrow(
      'Los datos cambiaron',
    );
  });

  it('confirma una sola creación con dos operaciones concurrentes', async () => {
    const date = day(7);
    const input = await file([date]);
    const [a, b] = await Promise.all([
      service.preview(actor, 1, input, newSession),
      service.preview(actor, 1, input, newSession),
    ]);
    const results = await Promise.allSettled([
      service.confirm(actor, 1, a.operationId!),
      service.confirm(actor, 1, b.operationId!),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((await service.preview(actor, 1, input, empty)).columns[0].candidates).toHaveLength(1);
  });

  it('importa varias fechas históricas, conserva tema, audita la hora real y reutiliza sin duplicar', async () => {
    const dates = [day(-10), day(-11)];
    const input = await file(dates, [
      ['0002', 1, 0],
      ['0003', 2, null],
    ]);
    const options = empty;
    const before = Date.now();
    const preview = await service.preview(actor, 1, input, options);
    expect(preview.errors).toEqual([]);
    expect(preview.warnings.join(' ')).toMatch(/fechas anteriores/);
    await expect(service.confirm(actor, 1, preview.operationId!)).resolves.toMatchObject({
      newSessions: 2,
      created: 4,
      present: 1,
      absent: 2,
      excused: 1,
      empty: 1,
    });
    const operation = await database.source.getRepository(BulkOperation).findOneOrFail({
      where: { idBulkOperation: preview.operationId! },
      relations: { createdBy: true },
    });
    expect(operation.createdBy.idUser).toBe(actor.idUser);
    expect(operation.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(operation.completedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    const sessions = operation.metadata!.sessions as {
      date: string;
      sessionId: number;
      created: boolean;
    }[];
    expect(sessions.map((item) => item.date)).toEqual(dates);
    for (const { sessionId, date } of sessions) {
      const detail = await attendance.getSessionDetail(1, sessionId);
      expect(detail.mode).toBe(Mode.MANUAL);
      expect(detail.date).toBe(date);
      expect(detail.topic).toBeNull();
      expect(detail.attendances.every((mark) => mark.markedAt!.getTime() >= before - 1000)).toBe(
        true,
      );
    }
    await attendance.updateSessionTopic(1, sessions[0].sessionId, { topic: 'Tema histórico' });
    const count = await database.source.getRepository(AttendanceSession).count();
    const reused = await service.preview(actor, 1, input, empty);
    expect(reused.summary).toMatchObject({ newSessions: 0, reused: 2, skipped: 4 });
    expect(reused.columns[0].selected).toMatchObject({
      mode: Mode.MANUAL,
      topic: 'Tema histórico',
    });
    await service.confirm(actor, 1, reused.operationId!);
    await service.confirm(actor, 1, preview.operationId!);
    expect(await database.source.getRepository(AttendanceSession).count()).toBe(count);
    expect((await attendance.getSessionDetail(1, sessions[0].sessionId)).topic).toBe(
      'Tema histórico',
    );
  });

  it('rechaza fechas fuera del semestre incluso si ya existe una sesión y revalida al confirmar', async () => {
    const date = day(-12);
    const input = await file([date]);
    const ready = await service.preview(actor, 1, input, newSession);
    const [original]: { start_date: Date; end_date: Date }[] = await database.source.query(
      'SELECT start_date,end_date FROM semesters WHERE id_semester=1',
    );
    await database.source.query('UPDATE semesters SET start_date=$1 WHERE id_semester=1', [
      `${day(-5)}T04:00:00Z`,
    ]);
    try {
      const invalid = await service.preview(actor, 1, input, newSession);
      expect(invalid.operationId).toBeNull();
      expect(invalid.columns[0].allowCreate).toBe(false);
      expect(invalid.errors[0].message).toMatch(/fuera del período/);
      const reused = await service.preview(actor, 1, await file([day(-10)]), empty);
      expect(reused.operationId).toBeNull();
      await expect(service.confirm(actor, 1, ready.operationId!)).rejects.toThrow(
        /datos cambiaron/,
      );
    } finally {
      await database.source.query(
        'UPDATE semesters SET start_date=$1,end_date=$2 WHERE id_semester=1',
        [original.start_date, original.end_date],
      );
    }
  });

  it.each([Mode.MANUAL, Mode.GEOLOCATION, Mode.QR, Mode.GEOLOCATION_QR])(
    'mantiene el rechazo ordinario de fechas pasadas en %s aunque el cliente pida omitir validación',
    async (mode) => {
      await request(app.getHttpServer() as Server)
        .post('/api/attendances/sessions')
        .send({
          enrollmentId: 1,
          date: day(-20),
          mode,
          ignoreDateValidation: true,
        })
        .expect(400);
      await expect(
        attendance.createSession(1, { enrollmentId: 1, date: day(-20), mode }),
      ).rejects.toThrow('SESSION_DATE_PAST');
    },
  );

  it('exige permisos de importación y creación también para fechas históricas', async () => {
    const input = await file([day(-15)]);
    await expect(
      service.preview({ ...actor, permissions: [] }, 1, input, newSession),
    ).rejects.toThrow();
    await expect(service.preview({ ...actor, idUser: 2 }, 1, input, newSession)).rejects.toThrow();
    const preview = await service.preview(
      { ...actor, permissions: actor.permissions.filter((p) => p !== 'attendance.session.create') },
      1,
      input,
      newSession,
    );
    expect(preview.operationId).toBeNull();
    expect(preview.errors[0].message).toMatch(/permiso/);
  });

  it('muestra una sesión QR cerrada y conserva su estado', async () => {
    const date = day(-2);
    await database.source.query(
      `INSERT INTO attendance_sessions
       (date,id_assistant_enrollment,mode,starts_at,ends_at,opened_at,closed_at)
       VALUES ($1::date,1,'QR',$2,$3,$4,$5)`,
      [date, `${date}T14:00Z`, `${date}T16:00Z`, `${date}T13:50Z`, `${date}T15:00Z`],
    );
    const preview = await service.preview(actor, 1, await file([date]), {
      ...empty,
      updateExisting: true,
    });
    expect(preview.operationId).toBeNull();
    expect(preview.columns[0].candidates[0]).toMatchObject({
      mode: 'QR',
      state: 'CLOSED',
      editable: false,
    });
  });

  it('completa el flujo HTTP multipart y deja marcas manuales en el cálculo académico', async () => {
    const client = request(app.getHttpServer() as Server);
    const path = '/api/attendances/import/1';
    const input = await file(
      [day(8)],
      [
        ['0002', 1],
        ['0003', 2],
      ],
    );
    await client.get(`${path}/template`).set('x-fixture-access', 'denied').expect(403);
    await client
      .get(`${path}/template`)
      .expect(200)
      .expect('Content-Disposition', /\.xlsx/);
    const repository = database.source.getRepository(Attendance);
    const before = await academicAttendanceCounts(repository, 1, [2, 3], new Date());
    const preview = await client
      .post(`${path}/preview`)
      .field('options', JSON.stringify(empty))
      .attach('file', input.buffer, input.originalname)
      .expect(200);
    const { operationId } = (preview.body as { data: { operationId: string } }).data;
    const confirmed = await client.post(`${path}/${operationId}/confirm`).expect(200);
    expect(confirmed.body).toMatchObject({
      status: true,
      data: { created: 2, present: 1, excused: 1 },
    });
    const operation = await database.source
      .getRepository(BulkOperation)
      .findOneByOrFail({ idBulkOperation: operationId });
    const [{ sessionId }] = operation.metadata?.sessions as { sessionId: number }[];
    const marks = await repository.find({
      where: { attendanceSession: { idAttendanceSession: sessionId } },
      relations: { markedBy: true },
    });
    expect(marks).toHaveLength(2);
    expect(
      marks.every(
        (mark) =>
          mark.registrationMethod === AttendanceRegistrationMethod.MANUAL &&
          mark.markedBy?.idUser === actor.idUser,
      ),
    ).toBe(true);
    const after = await academicAttendanceCounts(repository, 1, [2, 3], new Date());
    for (const row of after) {
      const old = before.find((item) => item.enrollmentId === row.enrollmentId)!;
      expect(row.total).toBe(old.total + 1);
      expect(row.present).toBe(old.present + (row.enrollmentId === 2 ? 1 : 0));
      expect(row.excused).toBe(old.excused + (row.enrollmentId === 3 ? 1 : 0));
    }
  });

  it.each(['QR', 'GEOLOCATION', 'GEOLOCATION_QR', 'MANUAL'])(
    'rechaza una selección pública de modalidad %s fuera del contrato de importación',
    async (mode) => {
      const input = await file([day(-30)]);
      const client = request(app.getHttpServer() as Server);
      const path = '/api/attendances/import/1/preview';
      for (const options of [
        { ...empty, mode },
        { ...empty, choices: [{ column: 'B', sessionId: 'create', mode }] },
      ]) {
        await client
          .post(path)
          .field('options', JSON.stringify(options))
          .attach('file', input.buffer, input.originalname)
          .expect(400);
      }
    },
  );
});
