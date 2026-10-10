import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import type { Server } from 'node:http';
import request from 'supertest';
import { Not, QueryRunner } from 'typeorm';
import AppDataSource from 'src/database/datasource';
import { GradesController } from 'src/controllers/grades/grades.controller';
import { Grade } from 'src/entities/grades/grades.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { Activity } from 'src/entities/activities/activity.entity';
import { UsersService } from '../users/users.service';
import { SemestersService } from '../semesters/semesters.service';
import { CoursesService } from '../courses/courses.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { GradesService } from './grades.service';
import { CourseRelations } from '@common/enums/courseRelations';
import { PermissionsGuard } from '@core/guards/permissions/permissions.guard';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { ResponseInterceptor } from '@core/interceptors/response/response.interceptor';
import { HttpExceptionFilter } from '@core/filters/http-exception/http-exception.filter';
import { averageScores, isAttendanceCriterion } from '@repo/grade-calculations';

// Explicit opt-in; every fixture and grade write is rolled back, with no seed or migration.
const databaseTest = process.env.RUN_GRADE_MATRIX_DB_TESTS === '1' ? describe : describe.skip;
databaseTest('Grade matrix HTTP and PostgreSQL regression', () => {
  let app: INestApplication;
  let runner: QueryRunner;
  let grades: GradesService;
  let enrollments: EnrollmentsService;
  let assistant: Enrollment;
  let students: Enrollment[];
  let activities: Activity[];
  let detail: GradeSchemeDetail;
  let user: { idUser: number; roles: string[]; permissions: string[] };

  beforeAll(async () => {
    await AppDataSource.initialize();
    runner = AppDataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const manager = runner.manager;
    const scheme = await manager.getRepository(GradeScheme).findOneOrFail({
      where: { isActive: true, assistantEnrollment: { isActive: true } },
      relations: {
        assistantEnrollment: { user: true, course: true, semester: true },
        details: { gradeItem: true },
      },
    });
    if (!scheme.assistantEnrollment) throw new Error('An active assistant fixture is required');
    assistant = scheme.assistantEnrollment;
    students = await manager.getRepository(Enrollment).find({
      where: {
        role: CourseRelations.STUDENT,
        isActive: true,
        course: { idCourse: assistant.course.idCourse },
        semester: { idSemester: assistant.semester.idSemester },
      },
      take: 2,
    });
    expect(students).toHaveLength(2);
    const item = scheme.details.find(
      (candidate) => !isAttendanceCriterion(candidate.gradeItem.name),
    )?.gradeItem;
    if (!item) throw new Error('A non-attendance criterion fixture is required');
    scheme.assistantPercentage = 20;
    await manager.getRepository(GradeScheme).save(scheme);
    detail = await manager
      .getRepository(GradeSchemeDetail)
      .save(
        manager
          .getRepository(GradeSchemeDetail)
          .create({ gradeScheme: scheme, gradeItem: item, percentage: 60, order: 999 }),
      );
    activities = await manager.getRepository(Activity).save(
      [0, 1, 2, 3].map((index) =>
        manager.getRepository(Activity).create({
          name: `Matrix regression ${index}`,
          gradeSchemeDetail: detail,
          dueDate: '2026-10-15',
          publicationDate: '2026-10-01',
          isActive: index !== 3,
        }),
      ),
    );
    enrollments = new EnrollmentsService(
      manager.getRepository(Enrollment),
      {} as UsersService,
      {} as SemestersService,
      {} as CoursesService,
    );
    grades = new GradesService(
      manager.getRepository(Grade),
      manager.getRepository(Enrollment),
      manager.getRepository(GradeSchemeDetail),
      manager.getRepository(Activity),
      enrollments,
    );
    user = {
      idUser: assistant.user.idUser,
      roles: ['AUXILIAR'],
      permissions: ['grade.create', 'grade.update', 'grade.get-by-enrollment'],
    };
    const module = await Test.createTestingModule({
      controllers: [GradesController],
      providers: [{ provide: GradesService, useValue: grades }],
    }).compile();
    app = module.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      Object.assign(req, { user });
      next();
    });
    app.useGlobalGuards(new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(createValidationPipe());
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
    await grades.create(user.idUser, {
      enrollmentId: students[0].idEnrollment,
      activityId: activities[0].idActivity,
      gradeSchemeDetailId: detail.idGradeSchemeDetail,
      score: 80,
    });
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    if (runner) await runner.release();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  const save = (cells: { enrollmentId: number; activityId: number; score: number }[]) =>
    request(app.getHttpServer() as Server)
      .patch(`/api/grades/bulk/${assistant.idEnrollment}`)
      .send({ grades: cells });
  it('bulk creates, updates and mixes cells with exact FK confirmation in the response envelope', async () => {
    const created = {
      enrollmentId: students[1].idEnrollment,
      activityId: activities[0].idActivity,
      score: 0,
    };
    const response = await save([created]).expect(200);
    expect(response.body).toMatchObject({
      status: true,
      data: { grades: [{ ...created, idGrade: expect.any(Number) as number }] },
    });
    const updated = {
      enrollmentId: students[0].idEnrollment,
      activityId: activities[0].idActivity,
      score: 100,
    };
    expect((await save([updated]).expect(200)).body).toMatchObject({ data: { grades: [updated] } });
    const mixed = [
      { ...updated, score: 80 },
      { ...updated, activityId: activities[1].idActivity, score: 70 },
    ];
    const result = await save(mixed).expect(200);
    expect(result.body).toMatchObject({
      status: true,
      data: {
        grades: expect.arrayContaining(
          mixed.map((cell) => expect.objectContaining(cell) as unknown),
        ) as unknown[],
      },
    });
    const stored = await grades.getByEnrollment(user.idUser, students[0].idEnrollment);
    expect(
      stored.find((grade) => grade.activity?.idActivity === activities[1].idActivity)?.score,
    ).toBe('70.00');
  }, 60000);
  it('uses all active activities consistently in matrix, summary and individual grading', async () => {
    await runner.manager.getRepository(Grade).save({
      enrollment: students[0],
      activity: activities[3],
      gradeSchemeDetail: detail,
      score: 100,
    });
    const matrix = await grades.getMatrix(
      user.idUser,
      assistant.idEnrollment,
      detail.idGradeSchemeDetail,
    );
    expect(matrix.activities).toHaveLength(3);
    const raw = averageScores(
      matrix.activities.map(
        (activity) =>
          matrix.grades.find(
            (grade) =>
              grade.enrollmentId === students[0].idEnrollment &&
              grade.activityId === activity.idActivity,
          )?.score ?? null,
      ),
    );
    expect(raw).toBe(50);
    const summary = await enrollments.getStudentGradeSummary(user.idUser, assistant.idEnrollment);
    expect(
      summary.students
        .find((student) => student.idEnrollment === students[0].idEnrollment)
        ?.details.find((item) => item.idGradeSchemeDetail === detail.idGradeSchemeDetail),
    ).toEqual({ idGradeSchemeDetail: detail.idGradeSchemeDetail, rawScore: 50, weightedScore: 6 });
    const individual = await grades.getByEnrollment(user.idUser, students[0].idEnrollment);
    expect(
      individual.some((grade) => grade.activity?.idActivity === activities[3].idActivity),
    ).toBe(false);
    expect(
      averageScores(
        individual
          .filter(
            (grade) => grade.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
          )
          .map((grade) => grade.score),
        matrix.activities.length,
      ),
    ).toBe(50);
  }, 60000);
  it('excludes soft-deleted activities from the divisor as well as inactive activities', async () => {
    await runner.manager.getRepository(Activity).softDelete(activities[2].idActivity);
    const matrix = await grades.getMatrix(
      user.idUser,
      assistant.idEnrollment,
      detail.idGradeSchemeDetail,
    );
    expect(matrix.activities).toHaveLength(2);
    const summary = await enrollments.getStudentGradeSummary(user.idUser, assistant.idEnrollment);
    expect(
      summary.students
        .find((student) => student.idEnrollment === students[0].idEnrollment)
        ?.details.find((item) => item.idGradeSchemeDetail === detail.idGradeSchemeDetail)?.rawScore,
    ).toBe(75);
    await runner.manager.getRepository(Activity).restore(activities[2].idActivity);
  }, 60000);
  it.each([-1, 101])('rejects invalid score %s through the HTTP ValidationPipe', async (score) => {
    const response = await save([
      { enrollmentId: students[0].idEnrollment, activityId: activities[0].idActivity, score },
    ]).expect(400);
    expect(response.body).toMatchObject({ status: false, statusCode: 400 });
  });
  it('rejects foreign enrollment, activity and missing write permission without changing ownership checks', async () => {
    const foreign = await runner.manager.getRepository(Enrollment).findOneOrFail({
      where: {
        role: CourseRelations.STUDENT,
        course: { idCourse: Not(assistant.course.idCourse) },
      },
    });
    await save([
      { enrollmentId: foreign.idEnrollment, activityId: activities[0].idActivity, score: 85 },
    ]).expect(403);
    await save([
      { enrollmentId: students[0].idEnrollment, activityId: 2147483647, score: 85 },
    ]).expect(403);
    user.permissions = ['grade.create'];
    await save([
      { enrollmentId: students[0].idEnrollment, activityId: activities[0].idActivity, score: 85 },
    ]).expect(403);
  }, 60000);
});
