import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner } from 'typeorm';
import AppDataSource from 'src/database/datasource';
import { Course } from 'src/entities/courses/courses.entity';
import { Activity } from 'src/entities/activities/activity.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { ActivitiesService } from './activities.service';
import { AssistantGradeSchemesService } from '../grade-schemes/assistant-grade-schemes.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { GradesService } from '../grades/grades.service';
import { UsersService } from '../users/users.service';
import { SemestersService } from '../semesters/semesters.service';
import { CoursesService } from '../courses/courses.service';
import { CourseRelations } from '@common/enums/courseRelations';

// Explicitly opt in: all writes use one transaction, always rolled back.
const databaseTest = process.env.RUN_ACTIVITY_DB_TESTS === '1' ? describe : describe.skip;
databaseTest('Activity lifecycle against PostgreSQL', () => {
  let runner: QueryRunner;
  let activities: ActivitiesService;
  let summaries: AssistantGradeSchemesService;
  let enrollments: EnrollmentsService;
  let grades: GradesService;
  let assistant: Enrollment;
  let students: Enrollment[];
  let detail: GradeSchemeDetail;

  beforeAll(async () => {
    await AppDataSource.initialize();
    runner = AppDataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const manager = runner.manager;
    assistant = await manager.getRepository(Enrollment).findOneOrFail({
      where: {
        role: CourseRelations.ASSISTANT,
        isActive: true,
        course: { name: 'Tecnologías emergentes' },
      },
      relations: { user: true, course: true, semester: true },
    });
    students = await manager.getRepository(Enrollment).find({
      where: {
        role: CourseRelations.STUDENT,
        isActive: true,
        course: { idCourse: assistant.course.idCourse },
        semester: { idSemester: assistant.semester.idSemester },
      },
      relations: { user: true },
      take: 2,
    });
    expect(students).toHaveLength(2);
    const scheme = await manager.getRepository(GradeScheme).findOneOrFail({
      where: { assistantEnrollment: { idEnrollment: assistant.idEnrollment } },
      relations: { details: { gradeItem: true } },
    });
    detail = await manager.getRepository(GradeSchemeDetail).save(
      manager.getRepository(GradeSchemeDetail).create({
        gradeScheme: scheme,
        gradeItem: scheme.details[0].gradeItem,
        percentage: 0,
        order: 999,
      }),
    );
    const module = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        AssistantGradeSchemesService,
        EnrollmentsService,
        GradesService,
        ...[Activity, Grade, GradeScheme, GradeSchemeDetail, Enrollment].map((entity) => ({
          provide: getRepositoryToken(entity),
          useValue: manager.getRepository(entity),
        })),
        { provide: DataSource, useValue: AppDataSource },
        { provide: UsersService, useValue: {} },
        { provide: SemestersService, useValue: {} },
        { provide: CoursesService, useValue: {} },
      ],
    }).compile();
    activities = module.get(ActivitiesService);
    summaries = module.get(AssistantGradeSchemesService);
    enrollments = module.get(EnrollmentsService);
    grades = module.get(GradesService);
  }, 120000);

  afterAll(async () => {
    if (runner?.isTransactionActive) await runner.rollbackTransaction();
    if (runner) await runner.release();
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  });

  async function create(name: string, dueDate = '2026-10-20') {
    return activities.create(assistant.course.idCourse, assistant.user.idUser, {
      name,
      dueDate,
      gradeSchemeDetailId: detail.idGradeSchemeDetail,
    });
  }
  async function assertCount(total: number) {
    const scheme = await summaries.getMyScheme(
      assistant.user.idUser,
      assistant.course.idCourse,
      assistant.idEnrollment,
    );
    expect(
      scheme?.details.find((item) => item.idGradeSchemeDetail === detail.idGradeSchemeDetail)
        ?.activities,
    ).toHaveLength(total);
    expect(await activities.getByGradeSchemeDetail(detail.idGradeSchemeDetail)).toHaveLength(total);
    // Student detail uses the same assistant scheme and its own managed enrollment/grade response.
    expect(
      (await enrollments.getManagedEnrollment(assistant.user.idUser, students[0].idEnrollment))
        .idEnrollment,
    ).toBe(students[0].idEnrollment);
  }

  it('counts 1 → 0 → 1; retains historical grades, restores, and counts an activity once with multiple grades', async () => {
    const a = await create('Regression A');
    await assertCount(1);
    for (const student of students)
      await grades.create(assistant.user.idUser, {
        enrollmentId: student.idEnrollment,
        gradeSchemeDetailId: detail.idGradeSchemeDetail,
        activityId: a.idActivity,
        score: 75,
      });
    await assertCount(1);
    await activities.delete(a.idActivity, assistant.user.idUser);
    await assertCount(0);
    expect(
      (await grades.getByEnrollment(assistant.user.idUser, students[0].idEnrollment)).filter(
        (grade) => grade.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
      ),
    ).toHaveLength(0);
    expect(
      await runner.manager.getRepository(Grade).countBy({ activity: { idActivity: a.idActivity } }),
    ).toBe(2);
    const b = await create('Regression B');
    await assertCount(1);
    await activities.reactivate(a.idActivity, assistant.user.idUser);
    await assertCount(2);
    expect(
      (await grades.getByEnrollment(assistant.user.idUser, students[0].idEnrollment)).filter(
        (grade) => grade.activity?.idActivity === a.idActivity,
      ),
    ).toHaveLength(1);
    await activities.delete(a.idActivity, assistant.user.idUser);
    await activities.delete(b.idActivity, assistant.user.idUser);
    await assertCount(0);
  }, 120000);

  it('orders B,C,A by deadline, updates without manual order, and counts 3 minus 1 as 2', async () => {
    const a = await create('Regression A', '2026-10-20');
    const b = await create('Regression B', '2026-10-10');
    const c = await create('Regression C', '2026-10-15');
    await assertCount(3);
    expect(
      (await activities.getByGradeSchemeDetail(detail.idGradeSchemeDetail)).map(
        (item) => item.idActivity,
      ),
    ).toEqual([b.idActivity, c.idActivity, a.idActivity]);
    const scheme = await summaries.getMyScheme(
      assistant.user.idUser,
      assistant.course.idCourse,
      assistant.idEnrollment,
    );
    expect(
      scheme?.details
        .find((item) => item.idGradeSchemeDetail === detail.idGradeSchemeDetail)
        ?.activities.map((item) => item.idActivity),
    ).toEqual([b.idActivity, c.idActivity, a.idActivity]);
    await activities.update(a.idActivity, assistant.user.idUser, {
      name: 'Regression edited',
      dueDate: '2026-10-10',
    });
    expect(
      (await activities.getByGradeSchemeDetail(detail.idGradeSchemeDetail)).map(
        (item) => item.idActivity,
      ),
    ).toEqual([a.idActivity, b.idActivity, c.idActivity]);
    await activities.delete(b.idActivity, assistant.user.idUser);
    await assertCount(2);
  }, 120000);
  it('enforces normalized names across the course, allows another course and reuse after deletion, and validates editing/restoration', async () => {
    const name = 'Práctica de unicidad';
    const a = await create(name);
    for (const duplicate of [name, ' práctica de unicidad ', 'PRÁCTICA DE UNICIDAD']) {
      await expect(create(duplicate)).rejects.toThrow(
        'Ya existe una actividad con ese nombre en esta materia.',
      );
    }
    const otherDetail = await runner.manager.getRepository(GradeSchemeDetail).save(
      runner.manager.getRepository(GradeSchemeDetail).create({
        gradeScheme: detail.gradeScheme,
        gradeItem: detail.gradeItem,
        percentage: 0,
        order: 1000,
      }),
    );
    await expect(
      activities.create(assistant.course.idCourse, assistant.user.idUser, {
        name,
        dueDate: '2026-10-20',
        gradeSchemeDetailId: otherDetail.idGradeSchemeDetail,
      }),
    ).rejects.toThrow('Ya existe una actividad con ese nombre');

    const course = await runner.manager
      .getRepository(Course)
      .save(
        runner.manager
          .getRepository(Course)
          .create({ name: 'Curso temporal de regresión', code: `REG-${Date.now()}`, group: 1 }),
      );
    const otherEnrollment = await runner.manager.getRepository(Enrollment).save(
      runner.manager.getRepository(Enrollment).create({
        course,
        user: assistant.user,
        semester: assistant.semester,
        role: CourseRelations.ASSISTANT,
      }),
    );
    const otherScheme = await runner.manager.getRepository(GradeScheme).save(
      runner.manager.getRepository(GradeScheme).create({
        name: 'Esquema temporal',
        assistantEnrollment: otherEnrollment,
        assistantPercentage: 10,
      }),
    );
    const courseDetail = await runner.manager.getRepository(GradeSchemeDetail).save(
      runner.manager.getRepository(GradeSchemeDetail).create({
        gradeScheme: otherScheme,
        gradeItem: detail.gradeItem,
        percentage: 100,
        order: 1,
      }),
    );
    const inOtherCourse = await activities.create(course.idCourse, assistant.user.idUser, {
      name,
      dueDate: '2026-10-20',
      gradeSchemeDetailId: courseDetail.idGradeSchemeDetail,
    });
    expect(inOtherCourse.name).toBe(name);

    const b = await create('Otra práctica de unicidad');
    await expect(
      activities.update(b.idActivity, assistant.user.idUser, { name: ' PRÁCTICA DE UNICIDAD ' }),
    ).rejects.toThrow('Ya existe una actividad con ese nombre');
    expect(
      (await activities.update(a.idActivity, assistant.user.idUser, { name: ` ${name} ` })).name,
    ).toBe(name);
    await activities.delete(a.idActivity, assistant.user.idUser);
    const reused = await create(` ${name} `);
    expect(reused.name).toBe(name);
    await expect(activities.reactivate(a.idActivity, assistant.user.idUser)).rejects.toThrow(
      'Ya existe una actividad con ese nombre',
    );
    await activities.delete(reused.idActivity, assistant.user.idUser);
    expect((await activities.reactivate(a.idActivity, assistant.user.idUser)).isActive).toBe(true);
  }, 120000);
});
