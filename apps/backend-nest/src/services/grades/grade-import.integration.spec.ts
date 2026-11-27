import * as Excel from 'exceljs';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { createAcademicTestDatabase } from '../../../test/academic-postgres';
import type { JwtPayload } from '@common/types/jwt-payload.type';
import { GradeImportController } from 'src/controllers/grades/grade-import.controller';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { Activity } from 'src/entities/activities/activity.entity';
import { BulkOperation } from 'src/entities/bulk-operations/bulk-operation.entity';
import { BulkOperationRow } from 'src/entities/bulk-operations/bulk-operation-row.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { ActivitiesService } from '../activities/activities.service';
import { BulkOperationsService } from '../bulk-operations/bulk-operations.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import type { CoursesService } from '../courses/courses.service';
import type { SemestersService } from '../semesters/semesters.service';
import type { UsersService } from '../users/users.service';
import { GradeImportService } from './grade-import.service';
import { GradesService } from './grades.service';

const pgBin = process.env.GRADE_IMPORT_TEST_PG_BIN;
const isolated = pgBin ? describe : describe.skip;
isolated('Importación de notas con PostgreSQL aislado', () => {
  let app: INestApplication;
  let database: Awaited<ReturnType<typeof createAcademicTestDatabase>>;
  let service: GradeImportService;
  let grades: GradesService;
  let enrollments: EnrollmentsService;
  let activities: ActivitiesService;
  let existingId: number;
  const actor: JwtPayload = {
    idUser: 1,
    idSession: 1,
    email: 'academic-1@test.invalid',
    username: 'academic-1',
    roles: ['AUXILIAR'],
    permissions: ['grade.create', 'grade.update', 'activity.create'],
  };
  const emptyOptions = { choices: [], updateExisting: false };

  async function file(rows: Excel.CellValue[][]) {
    const book = new Excel.Workbook();
    const sheet = book.addWorksheet('Notas');
    rows.forEach((row) => sheet.addRow(row));
    const buffer = Buffer.from(await book.xlsx.writeBuffer());
    return { buffer, originalname: 'notas.xlsx', size: buffer.length } as Express.Multer.File;
  }

  beforeAll(async () => {
    database = await createAcademicTestDatabase(pgBin!);
    const { source } = database;
    await source.query(`UPDATE users SET ru = '000' || id_user::text`);
    await source.query(`INSERT INTO grade_items(name) VALUES ('Asistencia')`);
    await source.query(
      `INSERT INTO grade_scheme_details(id_grade_scheme,id_grade_item,percentage,"order") VALUES(1,2,0,2)`,
    );
    const enrollment = source.getRepository(Enrollment);
    const activity = source.getRepository(Activity);
    const details = source.getRepository(GradeSchemeDetail);
    enrollments = new EnrollmentsService(
      enrollment,
      {} as UsersService,
      {} as SemestersService,
      {} as CoursesService,
    );
    grades = new GradesService(
      source.getRepository(Grade),
      enrollment,
      details,
      activity,
      enrollments,
    );
    activities = new ActivitiesService(activity, details, enrollment);
    service = new GradeImportService(
      source,
      enrollments,
      new BulkOperationsService(
        source.getRepository(BulkOperation),
        source.getRepository(BulkOperationRow),
      ),
      activities,
      grades,
    );
    existingId = (
      await activities.create(1, 1, {
        name: 'Práctica 1',
        dueDate: '2026-10-15',
        gradeSchemeDetailId: 1,
      })
    ).idActivity;
    await activities.create(1, 1, {
      name: 'Control asistencia',
      dueDate: '2026-10-15',
      gradeSchemeDetailId: 2,
    });
    await grades.saveBulk(actor, 1, {
      grades: [{ activityId: existingId, enrollmentId: 2, score: 75 }],
    });
    const fixture = await Test.createTestingModule({
      controllers: [GradeImportController],
      providers: [{ provide: GradeImportService, useValue: service }],
    }).compile();
    app = fixture.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, {
        user:
          req.headers['x-fixture-access'] === 'denied'
            ? { ...actor, roles: ['STUDENT'], permissions: [] }
            : actor,
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

  it('descarga únicamente los RU matriculados y excluye asistencia', async () => {
    const book = new Excel.Workbook();
    await book.xlsx.load(new Uint8Array(await service.template(actor, 1)).buffer);
    const sheet = book.worksheets[0];
    expect(sheet.getCell('A3').value).toBe('0002');
    expect(sheet.getCell('A4').value).toBe('0003');
    expect(sheet.getCell('A5').value).toBeNull();
    expect(sheet.getCell('B1').value).toBe('Práctica 1');
    expect(sheet.getCell('C1').value).toBeNull();
  });

  it('protege la plantilla y completa el ciclo multipart desde HTTP', async () => {
    const client = request(app.getHttpServer() as Server);
    const path = '/api/grades/import/1';
    await client.get(`${path}/template`).set('x-fixture-access', 'denied').expect(403);
    await client
      .get(`${path}/template`)
      .expect(200)
      .expect('Content-Disposition', /\.xlsx/);
    const workbook = await file([
      ['RU', 'practica 1'],
      [null, '15/10/2026'],
      ['0002', 80],
    ]);
    await client
      .post(`${path}/preview`)
      .field('options', 'null')
      .attach('file', workbook.buffer, workbook.originalname)
      .expect(400);
    const response = await client
      .post(`${path}/preview`)
      .field('options', JSON.stringify(emptyOptions))
      .attach('file', workbook.buffer, workbook.originalname)
      .expect(200);
    const { operationId } = (response.body as { data: { operationId: string } }).data;
    const confirmed = await client.post(`${path}/${operationId}/confirm`).expect(200);
    expect(confirmed.body).toMatchObject({ status: true, data: { skipped: 1, updated: 0 } });
  });

  it('bloquea RU duplicado, ajeno y vacío, fecha inválida, nota inválida y columnas repetidas', async () => {
    const workbook = await file([
      ['RU', 'Práctica 1', 'PRACTICA 1', null],
      [null, '15/10/2026', '15/10/2026', '31/02/2026'],
      ['0002', 101, -1, 'abc'],
      ['0002', 1.234],
      ['0004', 80],
      [null, 42],
    ]);
    const preview = await service.preview(actor, 1, workbook, emptyOptions);
    expect(preview.operationId).toBeNull();
    expect(preview.errors.map(({ column, row }) => column + row)).toEqual(
      expect.arrayContaining(['C1', 'D1', 'D2', 'A3', 'A4', 'A5', 'A6', 'B3', 'C3', 'D3', 'B4']),
    );
    await expect(
      service.preview({ ...actor, idUser: 2 }, 1, workbook, emptyOptions),
    ).rejects.toThrow();
    await expect(
      service.preview({ ...actor, permissions: [] }, 1, workbook, emptyOptions),
    ).rejects.toThrow();
  });

  it('solicita resolver una sugerencia y aceptar la discrepancia de fecha', async () => {
    const workbook = await file([
      ['RU', 'Práctica N.º 1'],
      [null, '16/10/2026'],
      ['0002', 45],
    ]);
    const suggested = await service.preview(actor, 1, workbook, emptyOptions);
    expect(suggested.columns[0].activity).toBeUndefined();
    expect(suggested.columns[0].suggestions[0].id).toBe(existingId);
    const chosen = { column: 'B', activityId: existingId, acceptDate: false };
    expect(
      (await service.preview(actor, 1, workbook, { ...emptyOptions, choices: [chosen] }))
        .operationId,
    ).toBeNull();
    const preview = await service.preview(actor, 1, workbook, {
      ...emptyOptions,
      choices: [{ ...chosen, acceptDate: true }],
    });
    expect(preview.summary).toMatchObject({ skipped: 1, warnings: 1 });
    const onlyImport = { ...actor, permissions: ['grade.create'] };
    await expect(service.confirm(onlyImport, 1, preview.operationId!)).resolves.toMatchObject({
      skipped: 1,
    });
    expect(
      (await database.source.getRepository(Activity).findOneByOrFail({ idActivity: existingId }))
        .dueDate,
    ).toBe('2026-10-15');
  });

  it('crea al confirmar, conserva vacíos, registra cero y actualiza la planilla y el resumen', async () => {
    const workbook = await file([
      ['RU', 'practica 1', 'Laboratorio 1'],
      [null, '15/10/2026', '22/10/2026'],
      ['0002', null, 50.25],
      ['0003', 0, null],
    ]);
    const options = { ...emptyOptions, choices: [{ column: 'C', detailId: 1 }] };
    const denied = await service.preview(
      { ...actor, permissions: ['grade.create'] },
      1,
      workbook,
      options,
    );
    expect(denied.operationId).toBeNull();
    const attendance = await service.preview(actor, 1, workbook, {
      ...options,
      choices: [{ column: 'C', detailId: 2 }],
    });
    expect(attendance.operationId).toBeNull();
    const preview = await service.preview(actor, 1, workbook, options);
    expect(
      await database.source.getRepository(Activity).findOneBy({ name: 'Laboratorio 1' }),
    ).toBeNull();
    const results = await Promise.allSettled([
      service.confirm(actor, 1, preview.operationId!),
      service.confirm(actor, 1, preview.operationId!),
    ]);
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
    const result = await service.confirm(actor, 1, preview.operationId!);
    expect(result).toMatchObject({ created: 2, updated: 0, newActivities: 1, empty: 2 });
    expect(await database.source.getRepository(Activity).countBy({ name: 'Laboratorio 1' })).toBe(
      1,
    );
    const matrix = await grades.getMatrix(1, 1, 1);
    expect(matrix.grades).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ activityId: existingId, enrollmentId: 2, score: 75 }),
        expect.objectContaining({ activityId: existingId, enrollmentId: 3, score: 0 }),
      ]),
    );
    expect(matrix.grades).toHaveLength(3);
    const report = await enrollments.getStudentGradeSummary(1, 1);
    expect(
      report.students.find((student) => student.idEnrollment === 2)?.details[0].rawScore,
    ).toBeCloseTo(62.625);
    expect(
      (await grades.getByEnrollment(1, 2)).some((grade) => Number(grade.score) === 50.25),
    ).toBe(true);
  });

  it('rechaza una vista previa obsoleta y actualiza con permiso tras volver a validar', async () => {
    const workbook = await file([
      ['RU', 'Práctica 1'],
      [null, '15/10/2026'],
      ['0002', 20],
    ]);
    const options = { ...emptyOptions, updateExisting: true };
    const stale = await service.preview(actor, 1, workbook, options);
    await grades.saveBulk(actor, 1, {
      grades: [{ activityId: existingId, enrollmentId: 2, score: 70 }],
    });
    await expect(service.confirm(actor, 1, stale.operationId!)).rejects.toThrow(
      'Los datos cambiaron',
    );
    const preview = await service.preview(actor, 1, workbook, options);
    await expect(
      service.confirm({ ...actor, permissions: ['grade.create'] }, 1, preview.operationId!),
    ).rejects.toThrow('actualizar');
    await expect(service.confirm(actor, 1, preview.operationId!)).resolves.toMatchObject({
      updated: 1,
    });
  });

  it('revierte actividades y permite reintentar después de un fallo de escritura', async () => {
    const workbook = await file([
      ['RU', 'Actividad atómica'],
      [null, '15/10/2026'],
      ['0002', 17],
    ]);
    const preview = await service.preview(actor, 1, workbook, {
      ...emptyOptions,
      choices: [{ column: 'B', detailId: 1 }],
    });
    const mock = jest.spyOn(grades, 'saveBulk').mockRejectedValueOnce(new Error('Fallo de prueba'));
    try {
      await expect(service.confirm(actor, 1, preview.operationId!)).rejects.toThrow(
        'Fallo de prueba',
      );
      expect(
        await database.source.getRepository(Activity).findOneBy({ name: 'Actividad atómica' }),
      ).toBeNull();
    } finally {
      mock.mockRestore();
    }
    await expect(service.confirm(actor, 1, preview.operationId!)).resolves.toMatchObject({
      created: 1,
    });
  });

  it('detecta una actividad creada entre vista previa y confirmación', async () => {
    const workbook = await file([
      ['RU', 'Actividad sobrevenida'],
      [null, '15/10/2026'],
      ['0002', 17],
    ]);
    const preview = await service.preview(actor, 1, workbook, {
      ...emptyOptions,
      choices: [{ column: 'B', detailId: 1 }],
    });
    await activities.create(1, 1, {
      name: 'Actividad sobrevenida',
      dueDate: '2026-10-15',
      gradeSchemeDetailId: 1,
    });
    await expect(service.confirm(actor, 1, preview.operationId!)).rejects.toThrow(
      'Los datos cambiaron',
    );
    expect(
      await database.source.getRepository(Activity).countBy({ name: 'Actividad sobrevenida' }),
    ).toBe(1);
  });

  it('exige resolución cuando dos nombres se normalizan igual y excluye actividades archivadas', async () => {
    const alternate = await activities.create(1, 1, {
      name: 'Practica 1',
      dueDate: '2026-10-15',
      gradeSchemeDetailId: 1,
    });
    const workbook = await file([
      ['RU', 'Práctica 1'],
      [null, '15/10/2026'],
      ['0002', 15],
    ]);
    const ambiguous = await service.preview(actor, 1, workbook, emptyOptions);
    expect(ambiguous.operationId).toBeNull();
    expect(ambiguous.columns[0].suggestions.map((item) => item.id)).toEqual([
      existingId,
      alternate.idActivity,
    ]);
    const options = {
      ...emptyOptions,
      choices: [{ column: 'B', activityId: alternate.idActivity }],
    };
    const explicit = await service.preview(actor, 1, workbook, options);
    expect(explicit.operationId).toBeTruthy();
    await activities.delete(alternate.idActivity, 1);
    await expect(service.confirm(actor, 1, explicit.operationId!)).rejects.toThrow(
      'Los datos cambiaron',
    );
    expect((await service.preview(actor, 1, workbook, options)).operationId).toBeNull();
  });

  it('dos operaciones distintas para la misma actividad y nota solo materializan una', async () => {
    const workbook = await file([
      ['RU', 'Actividad concurrente'],
      [null, '15/10/2026'],
      ['0002', 60],
    ]);
    const options = { ...emptyOptions, choices: [{ column: 'B', detailId: 1 }] };
    const [first, second] = await Promise.all([
      service.preview(actor, 1, workbook, options),
      service.preview(actor, 1, workbook, options),
    ]);
    expect(first.operationId).not.toBe(second.operationId);
    const results = await Promise.allSettled([
      service.confirm(actor, 1, first.operationId!),
      service.confirm(actor, 1, second.operationId!),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const activity = await database.source
      .getRepository(Activity)
      .findOneByOrFail({ name: 'Actividad concurrente' });
    expect(
      await database.source
        .getRepository(Grade)
        .countBy({ activity: { idActivity: activity.idActivity } }),
    ).toBe(1);
  });

  it('crea una sola actividad al repartir 501 notas entre lotes', async () => {
    await database.source.query(`INSERT INTO users(email,username,password,name,lastname,ci,ru)
      SELECT 'bulk-'||n||'@test.invalid','bulk-'||n,'unused','Synthetic','Fixture','bulk-'||n,'B'||n
      FROM generate_series(1,501)n`);
    await database.source.query(`INSERT INTO enrollments(id_user,id_course,id_semester,role)
      SELECT id_user,1,1,'STUDENT' FROM users WHERE username LIKE 'bulk-%'`);
    const rows: Excel.CellValue[][] = [
      ['RU', 'Actividad de varios lotes'],
      [null, '15/10/2026'],
    ];
    for (let index = 1; index <= 501; index++) rows.push([`B${index}`, 42]);
    const preview = await service.preview(actor, 1, await file(rows), {
      ...emptyOptions,
      choices: [{ column: 'B', detailId: 1 }],
    });
    expect(preview.summary).toMatchObject({
      created: 501,
      identified: 501,
      newActivities: 1,
      errors: 0,
    });
    await expect(service.confirm(actor, 1, preview.operationId!)).resolves.toMatchObject({
      created: 501,
      newActivities: 1,
    });
    const activity = await database.source
      .getRepository(Activity)
      .findOneByOrFail({ name: 'Actividad de varios lotes' });
    expect(
      await database.source
        .getRepository(Grade)
        .countBy({ activity: { idActivity: activity.idActivity } }),
    ).toBe(501);
  });
});
