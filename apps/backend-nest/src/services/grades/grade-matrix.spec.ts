import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EntityManager, Repository } from 'typeorm';
import { GradesService } from './grades.service';
import { EnrollmentsService } from '../enrollments/enrollments.service';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { Activity } from 'src/entities/activities/activity.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { GradeSchemeDetail } from 'src/entities/grade-scheme-detail/grade-scheme-detail.entity';
import { BulkActivityGradesDto } from 'src/dtos/grades/bulk-activity-grades.dto';
import { ACTIVITY_ORDER, compareActivities } from '@common/utils/activity-rules';
import { assertGradeActivity, assertGradeSchemeAccess } from '@common/utils/grade-rules';
import { UniqueActivityGrade1791547200000 } from 'src/database/migrations/1791547200000-UniqueActivityGrade';
import type { QueryRunner } from 'typeorm';

const user = {
  idUser: 4,
  roles: ['AUXILIAR'],
  permissions: ['grade.create', 'grade.update', 'grade.get-by-enrollment'],
};
function fixture(studentCount = 2) {
  const assistant = {
    idEnrollment: 1,
    isActive: true,
    user: { idUser: 4, name: 'Auxiliar', lastname: 'Actual' },
    course: { idCourse: 3, code: 'SIS-1', name: 'Materia', group: 1 },
    semester: { idSemester: 5 },
  } as Enrollment;
  const details = [
    {
      idGradeSchemeDetail: 10,
      order: 1,
      percentage: 60,
      gradeItem: { name: 'Evaluación configurable' },
    },
    { idGradeSchemeDetail: 11, order: 2, percentage: 30, gradeItem: { name: 'Otro criterio' } },
    { idGradeSchemeDetail: 12, order: 3, percentage: 10, gradeItem: { name: 'Asistencias' } },
  ] as GradeSchemeDetail[];
  const scheme = {
    idGradeScheme: 2,
    isActive: true,
    assistantPercentage: 20,
    assistantEnrollment: assistant,
    details,
  } as GradeScheme;
  details.forEach((detail) => {
    detail.gradeScheme = scheme;
  });
  const activities = [
    {
      idActivity: 20,
      isActive: true,
      deletedAt: null,
      name: 'Entrega posterior',
      dueDate: '2026-10-22',
      createdAt: new Date('2026-10-01'),
      gradeSchemeDetail: details[0],
    },
    {
      idActivity: 21,
      isActive: true,
      deletedAt: null,
      name: 'Entrega anterior',
      dueDate: '2026-10-15',
      createdAt: new Date('2026-10-01'),
      gradeSchemeDetail: details[0],
    },
  ] as Activity[];
  const students = Array.from({ length: studentCount }, (_, index) => ({
    idEnrollment: 100 + index,
    isActive: true,
    user: {
      idUser: 100 + index,
      name: `Alumno ${index}`,
      lastname: 'Apellido',
      ci: `${index}`,
      ru: `${index}`,
    },
    course: assistant.course,
    semester: assistant.semester,
  })) as Enrollment[];
  const stored = new Map<
    string,
    { id_grade: number; id_enrollment: number; id_activity: number; score: string }
  >();
  stored.set('100:21', { id_grade: 7, id_enrollment: 100, id_activity: 21, score: '80' });
  let submitted: {
    enrollment: { idEnrollment: number };
    activity: { idActivity: number };
    score: number;
  }[] = [];
  const counts = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([
      { detailId: 10, count: '2' },
      { detailId: 12, count: '1' },
    ]),
  };
  const query = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(() =>
      Promise.resolve(
        Array.from(stored.values()).map((row) => ({
          idGrade: row.id_grade,
          enrollmentId: row.id_enrollment,
          activityId: row.id_activity,
          score: row.score,
        })),
      ),
    ),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    onConflict: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(() =>
      Promise.resolve({
        raw: submitted.map((input) => {
          const key = `${input.enrollment.idEnrollment}:${input.activity.idActivity}`;
          const row = {
            id_grade: stored.get(key)?.id_grade ?? 1000 + stored.size,
            id_enrollment: input.enrollment.idEnrollment,
            id_activity: input.activity.idActivity,
            score: String(input.score),
          };
          stored.set(key, row);
          return row;
        }),
      }),
    ),
  };
  query.values.mockImplementation((values: typeof submitted) => {
    submitted = values;
    return query;
  });
  const activityRepository = {
    find: jest.fn(() => Promise.resolve([...activities].sort(compareActivities))),
    findOne: jest.fn().mockResolvedValue(activities[1]),
    createQueryBuilder: jest.fn(() => counts),
  };
  const studentsRepository = {
    find: jest.fn().mockResolvedValue(students),
    findOne: jest.fn().mockResolvedValue(students[0]),
  };
  const schemeRepository = { findOne: jest.fn().mockResolvedValue(scheme) };
  const gradeRepository = {
    createQueryBuilder: jest.fn(() => query),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const repositories = new Map<unknown, unknown>([
    [GradeScheme, schemeRepository],
    [Activity, activityRepository],
    [Enrollment, studentsRepository],
    [Grade, gradeRepository],
  ]);
  const manager = {
    getRepository: jest.fn((entity: unknown) => repositories.get(entity)),
    transaction: jest.fn<Promise<unknown>, [(m: EntityManager) => Promise<unknown>]>(),
  };
  manager.transaction.mockImplementation((work) => work(manager as unknown as EntityManager));
  const enrollments = {
    getAssistantEnrollment: jest.fn().mockResolvedValue(assistant),
    getManagedEnrollment: jest.fn().mockResolvedValue(students[0]),
  };
  const service = new GradesService(
    { ...gradeRepository, manager } as unknown as Repository<Grade>,
    studentsRepository as unknown as Repository<Enrollment>,
    {
      findOne: jest.fn().mockResolvedValue(details[0]),
    } as unknown as Repository<GradeSchemeDetail>,
    activityRepository as unknown as Repository<Activity>,
    enrollments as unknown as EnrollmentsService,
  );
  return {
    service,
    manager,
    query,
    counts,
    scheme,
    details,
    activities,
    students,
    assistant,
    stored,
    enrollments,
    activityRepository,
    studentsRepository,
    schemeRepository,
    gradeRepository,
  };
}

describe('Activity grade matrix', () => {
  it('loads dynamic criteria, excludes attendance and returns the matrix with existing grades', async () => {
    const f = fixture();
    const matrix = await f.service.getMatrix(4, 1);
    expect(matrix.criteria.map((detail) => detail.name)).toEqual([
      'Evaluación configurable',
      'Otro criterio',
    ]);
    expect(matrix.enrollment.idCourse).toBe(3);
    expect(matrix.criteria[1].activityCount).toBe(0);
    expect(matrix.activities.map((activity) => activity.idActivity)).toEqual([21, 20]);
    expect(matrix.students).toHaveLength(2);
    expect(matrix.grades).toEqual([{ idGrade: 7, enrollmentId: 100, activityId: 21, score: 80 }]);
    expect(matrix.grades.some((grade) => grade.enrollmentId === 101)).toBe(false);
    expect(f.activityRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ order: ACTIVITY_ORDER }),
    );
  });
  it('supports arbitrary additional configured criteria', async () => {
    const f = fixture();
    f.counts.getRawMany.mockResolvedValue([
      { detailId: 10, count: '2' },
      { detailId: 11, count: '4' },
    ]);
    expect((await f.service.getMatrix(4, 1)).criteria.map((criterion) => criterion.name)).toEqual([
      'Evaluación configurable',
      'Otro criterio',
    ]);
  });
  it('offers compatible criteria with zero activities but never attendance', async () => {
    const f = fixture();
    f.counts.getRawMany.mockResolvedValue([]);
    f.activityRepository.find.mockResolvedValue([]);
    const matrix = await f.service.getMatrix(4, 1);
    expect(matrix.criteria.map((detail) => detail.activityCount)).toEqual([0, 0]);
    expect(matrix.detail?.idGradeSchemeDetail).toBe(10);
    expect(matrix.activities).toEqual([]);
    f.scheme.details = [f.details[2]];
    expect((await f.service.getMatrix(4, 1)).detail).toBeNull();
    expect((await f.service.getMatrix(4, 1)).criteria).toEqual([]);
  });
  it('preserves deadline, creation and ID ordering through the existing helper', () => {
    const base = fixture().activities[0];
    const rows = [
      { ...base, idActivity: 3 },
      { ...base, idActivity: 2 },
      { ...base, idActivity: 1, createdAt: new Date('2026-09-30') },
      { ...base, idActivity: 4, dueDate: '2026-10-01' },
    ];
    expect(rows.sort(compareActivities).map((activity) => activity.idActivity)).toEqual([
      4, 1, 2, 3,
    ]);
  });
  it.each([2, 50, 150])(
    'uses a constant number of repository operations for %s students',
    async (count) => {
      const f = fixture(count);
      expect((await f.service.getMatrix(4, 1)).students).toHaveLength(count);
      expect(f.query.getRawMany).toHaveBeenCalledTimes(1);
      expect(f.counts.getRawMany).toHaveBeenCalledTimes(1);
      expect(f.studentsRepository.find).toHaveBeenCalledTimes(1);
      expect(f.activityRepository.find).toHaveBeenCalledTimes(1);
    },
  );
  it('handles missing schema, no activity criteria, zero activities and no students', async () => {
    const f = fixture();
    f.schemeRepository.findOne.mockResolvedValueOnce(null);
    expect((await f.service.getMatrix(4, 1)).scheme).toBeNull();
    f.counts.getRawMany.mockResolvedValue([]);
    expect((await f.service.getMatrix(4, 1)).detail?.idGradeSchemeDetail).toBe(10);
    f.activityRepository.find.mockResolvedValueOnce([]);
    expect((await f.service.getMatrix(4, 1, 10)).activities).toEqual([]);
    f.studentsRepository.find.mockResolvedValueOnce([]);
    expect((await f.service.getMatrix(4, 1, 10)).students).toEqual([]);
  });
  it('rejects a criterion from another scheme and attendance', async () => {
    const f = fixture();
    await expect(f.service.getMatrix(4, 1, 999)).rejects.toThrow(BadRequestException);
    await expect(f.service.getMatrix(4, 1, 12)).rejects.toThrow(BadRequestException);
  });
});

describe('Atomic bulk activity grades', () => {
  it('creates missing Grades in one upsert statement', async () => {
    const f = fixture();
    const result = await f.service.saveBulk(user, 1, {
      grades: [{ enrollmentId: 101, activityId: 21, score: 90 }],
    });
    expect(result.grades[0]).toMatchObject({ enrollmentId: 101, activityId: 21, score: 90 });
    expect(f.manager.transaction).toHaveBeenCalledTimes(1);
    expect(f.query.execute).toHaveBeenCalledTimes(1);
    expect(f.query.returning).toHaveBeenCalledWith(
      '"id_grade", "id_enrollment", "id_activity", "score"',
    );
    expect(f.query.onConflict).toHaveBeenCalledWith(
      expect.stringContaining('DO UPDATE SET "score"'),
    );
  });
  it('updates an existing Grade without creating another identity', async () => {
    const f = fixture();
    const result = await f.service.saveBulk(user, 1, {
      grades: [{ enrollmentId: 100, activityId: 21, score: 95 }],
    });
    expect(result.grades[0]).toMatchObject({ idGrade: 7, score: 95 });
    expect(f.stored.size).toBe(1);
  });
  it('mixes create and update without per-cell SQL writes', async () => {
    const f = fixture();
    const result = await f.service.saveBulk(user, 1, {
      grades: [
        { enrollmentId: 100, activityId: 21, score: 85 },
        { enrollmentId: 101, activityId: 20, score: 75 },
      ],
    });
    expect(result.grades).toHaveLength(2);
    expect(f.query.execute).toHaveBeenCalledTimes(1);
    expect(f.query.values).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ gradeSchemeDetail: { idGradeSchemeDetail: 10 } }),
      ]),
    );
  });
  it.each([0, 100])('accepts the boundary score %s', async (score) => {
    const f = fixture();
    expect(
      (
        await f.service.saveBulk(user, 1, {
          grades: [{ enrollmentId: 100, activityId: 21, score }],
        })
      ).grades[0].score,
    ).toBe(score);
    expect(
      validateSync(
        plainToInstance(BulkActivityGradesDto, {
          grades: [{ enrollmentId: 100, activityId: 21, score }],
        }),
      ),
    ).toEqual([]);
  });
  it.each([-1, 101, NaN, Infinity])('rejects invalid score %s before any write', async (score) => {
    const f = fixture();
    await expect(
      f.service.saveBulk(user, 1, { grades: [{ enrollmentId: 100, activityId: 21, score }] }),
    ).rejects.toThrow(BadRequestException);
    expect(f.query.execute).not.toHaveBeenCalled();
    expect(
      validateSync(
        plainToInstance(BulkActivityGradesDto, {
          grades: [{ enrollmentId: 100, activityId: 21, score }],
        }),
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects foreign enrollment before inserting any otherwise valid cells', async () => {
    const f = fixture();
    await expect(
      f.service.saveBulk(user, 1, {
        grades: [
          { enrollmentId: 100, activityId: 21, score: 80 },
          { enrollmentId: 999, activityId: 21, score: 85 },
        ],
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(f.query.execute).not.toHaveBeenCalled();
  });
  it('rejects foreign activity/detail/scheme and inactive activities', async () => {
    const f = fixture();
    await expect(
      f.service.saveBulk(user, 1, { grades: [{ enrollmentId: 100, activityId: 999, score: 80 }] }),
    ).rejects.toThrow(ForbiddenException);
    f.activities[1].gradeSchemeDetail = {
      idGradeSchemeDetail: 999,
      gradeScheme: { idGradeScheme: 999 },
    } as GradeSchemeDetail;
    await expect(
      f.service.saveBulk(user, 1, { grades: [{ enrollmentId: 100, activityId: 21, score: 80 }] }),
    ).rejects.toThrow(ForbiddenException);
    expect(f.query.execute).not.toHaveBeenCalled();
  });
  it('rejects attendance even if someone attached an Activity to it', async () => {
    const f = fixture();
    f.activities[1].gradeSchemeDetail = f.details[2];
    await expect(
      f.service.saveBulk(user, 1, { grades: [{ enrollmentId: 100, activityId: 21, score: 80 }] }),
    ).rejects.toThrow(ForbiddenException);
  });
  it('requires ownership and BOTH existing write permissions', async () => {
    const f = fixture();
    await expect(
      f.service.saveBulk({ ...user, permissions: ['grade.create'] }, 1, {
        grades: [{ enrollmentId: 100, activityId: 21, score: 80 }],
      }),
    ).rejects.toThrow(ForbiddenException);
    f.enrollments.getAssistantEnrollment.mockRejectedValueOnce(new ForbiddenException());
    await expect(
      f.service.saveBulk(user, 999, { grades: [{ enrollmentId: 100, activityId: 21, score: 80 }] }),
    ).rejects.toThrow(ForbiddenException);
    expect(f.query.execute).not.toHaveBeenCalled();
  });
  it('rejects duplicate cells and empty batches', async () => {
    const f = fixture();
    const input = { enrollmentId: 100, activityId: 21, score: 80 };
    await expect(f.service.saveBulk(user, 1, { grades: [input, input] })).rejects.toThrow(
      BadRequestException,
    );
    await expect(f.service.saveBulk(user, 1, { grades: [] })).rejects.toThrow(BadRequestException);
    expect(f.query.execute).not.toHaveBeenCalled();
  });
  it('propagates a transaction failure instead of reporting partial success', async () => {
    const f = fixture();
    f.query.execute.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(
      f.service.saveBulk(user, 1, { grades: [{ enrollmentId: 100, activityId: 21, score: 80 }] }),
    ).rejects.toThrow('storage unavailable');
  });
  it('shares the same rules with individual grade creation', async () => {
    const f = fixture();
    await f.service.create(4, {
      enrollmentId: 100,
      gradeSchemeDetailId: 10,
      activityId: 21,
      score: 85,
    });
    expect(f.gradeRepository.save).toHaveBeenCalledTimes(1);
    expect(() => assertGradeSchemeAccess(99, f.students[0], f.details[0])).toThrow(
      ForbiddenException,
    );
    const otherSemester = { ...f.students[0], semester: { idSemester: 999 } } as Enrollment;
    expect(() => assertGradeSchemeAccess(4, otherSemester, f.details[0])).toThrow(
      BadRequestException,
    );
    expect(() =>
      assertGradeActivity({ ...f.activities[0], isActive: false }, f.details[0]),
    ).toThrow();
  });
  it('adds a reversible partial unique index without deleting existing data', async () => {
    const runner = { query: jest.fn().mockResolvedValue(undefined) };
    const migration = new UniqueActivityGrade1791547200000();
    await migration.up(runner as unknown as QueryRunner);
    expect(runner.query).toHaveBeenCalledWith(
      expect.stringContaining('("id_enrollment", "id_activity") WHERE "id_activity" IS NOT NULL'),
    );
    await migration.down(runner as unknown as QueryRunner);
    expect(runner.query).toHaveBeenLastCalledWith('DROP INDEX "UQ_grade_enrollment_activity"');
  });
});
