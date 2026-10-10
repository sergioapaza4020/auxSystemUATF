import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import {
  attendancePercentage,
  averageScores,
  criterionScore,
  totalScore,
  weightedScore,
} from '@repo/grade-calculations';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { GradeScheme } from 'src/entities/grade-schemes/grade-schemes.entity';
import { Activity } from 'src/entities/activities/activity.entity';
import { Grade } from 'src/entities/grades/grades.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';
import { SemestersService } from '../semesters/semesters.service';
import { EnrollmentsService } from './enrollments.service';
import { EnrollmentsController } from 'src/controllers/enrollments/enrollments.controller';
import { PERMISSIONS_KEY } from '@core/decorators/permissions/permissions.decorator';

function builder(rows: unknown[]) {
  const query = {
    setParameters: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  return query;
}
function fixture(count = 2) {
  const students = Array.from({ length: count }, (_, index) => ({ idEnrollment: index + 10 }));
  const scheme = {
    idGradeScheme: 1,
    assistantPercentage: 20,
    details: [
      {
        idGradeSchemeDetail: 1,
        order: 1,
        percentage: 60,
        gradeItem: { name: 'Proyecto configurable' },
      },
      { idGradeSchemeDetail: 2, order: 2, percentage: 30, gradeItem: { name: 'Asistencias' } },
      { idGradeSchemeDetail: 3, order: 3, percentage: 10, gradeItem: { name: 'Defensa oral' } },
    ],
  };
  const activities = builder([{ detailId: 1, count: '2' }]);
  const grades = builder([
    { enrollmentId: 10, detailId: 1, activityTotal: '180', directScore: '1' },
    { enrollmentId: 10, detailId: 3, activityTotal: null, directScore: '80' },
  ]);
  const attendances = builder([{ enrollmentId: 10, count: '4' }]);
  const sessions = { countBy: jest.fn().mockResolvedValue(5) };
  const schemes = { findOne: jest.fn().mockResolvedValue(scheme) };
  const repositories = new Map<unknown, unknown>([
    [GradeScheme, schemes],
    [Activity, { createQueryBuilder: jest.fn(() => activities) }],
    [Grade, { createQueryBuilder: jest.fn(() => grades) }],
    [Attendance, { createQueryBuilder: jest.fn(() => attendances) }],
    [AttendanceSession, sessions],
  ]);
  const getRepository = jest.fn((entity: unknown) => repositories.get(entity));
  const repository = { manager: { getRepository } } as unknown as Repository<Enrollment>;
  const service = new EnrollmentsService(
    repository,
    {} as UsersService,
    {} as SemestersService,
    {} as CoursesService,
  );
  jest.spyOn(service, 'getStudentsByEnrollment').mockResolvedValue(students as Enrollment[]);
  return { service, scheme, schemes, activities, grades, attendances, sessions, getRepository };
}

describe('Student grade summary', () => {
  it.each([
    { count: 3, total: '150', expected: 50 },
    { count: 3, total: '300', expected: 100 },
    { count: 4, total: '200', expected: 50 },
    { count: 3, total: null, expected: 0 },
  ])(
    'divides the graded total by all $count active activities',
    async ({ count, total, expected }) => {
      const f = fixture();
      f.activities.getRawMany.mockResolvedValue([{ detailId: 1, count: String(count) }]);
      f.grades.getRawMany.mockResolvedValue([
        { enrollmentId: 10, detailId: 1, activityTotal: total, directScore: null },
      ]);
      const result = await f.service.getStudentGradeSummary(2, 7);
      expect(result.students[0].details[0].rawScore).toBe(expected);
      expect(result.students[0].details[0].weightedScore).toBe(weightedScore(expected, 60, 0.2));
      expect(f.grades.addSelect).toHaveBeenCalledWith(
        'SUM(grade.score) FILTER (WHERE grade.id_activity IS NOT NULL)',
        'activityTotal',
      );
      expect(f.activities.andWhere).toHaveBeenCalledWith('activity.isActive = true');
    },
  );
  it.each([1, 0.5, 0])(
    'weights excused attendance in academic summaries with %s',
    async (weight) => {
      const f = fixture();
      Object.assign(f.scheme.details[1], { permissionWeight: weight });
      f.sessions.countBy.mockResolvedValue(7);
      f.attendances.getRawMany.mockResolvedValue([{ enrollmentId: 10, count: '5', excused: '1' }]);
      const result = await f.service.getStudentGradeSummary(2, 7);
      expect(result.students[0].details[1].rawScore).toBeCloseTo(((5 + weight) / 7) * 100, 8);
      expect(result.students[1].details[1].rawScore).toBe(0);
    },
  );
  it('uses configurable criteria, activity averages, attendance and direct grades', async () => {
    const { service } = fixture();
    const result = await service.getStudentGradeSummary(2, 7);
    expect(result.scheme?.details.map((detail) => detail.name)).toEqual([
      'Proyecto configurable',
      'Asistencias',
      'Defensa oral',
    ]);
    expect(result.students[0].details.map((detail) => detail.rawScore)).toEqual([90, 80, 80]);
    expect(result.students[0].details.map((detail) => detail.weightedScore)).toEqual([
      10.8, 4.8, 1.6,
    ]);
    expect(result.students[0].totalRaw).toBe(86);
    expect(result.students[0].assistantContribution).toBe(17.2);
    expect(result.scheme?.details[0].maximumScore).toBe(12);
  });
  it('preserves a real zero and distinguishes missing grades', async () => {
    const { service, grades, sessions } = fixture();
    sessions.countBy.mockResolvedValue(0);
    grades.getRawMany.mockResolvedValue([
      { enrollmentId: 10, detailId: 3, directScore: '0', activityTotal: null },
    ]);
    const result = await service.getStudentGradeSummary(2, 7);
    expect(result.students[0].details.map((detail) => detail.rawScore)).toEqual([0, null, 0]);
    expect(result.students[0].totalRaw).toBe(0);
    expect(result.students[1].totalRaw).toBe(0);
  });
  it('supports additional arbitrary direct criteria and their configured order', async () => {
    const { service, scheme } = fixture();
    scheme.details.push({
      idGradeSchemeDetail: 4,
      order: 0,
      percentage: 0,
      gradeItem: { name: 'Criterio adicional' },
    });
    expect((await service.getStudentGradeSummary(2, 7)).scheme?.details[0].name).toBe(
      'Criterio adicional',
    );
  });
  it('handles missing or empty schemes without aggregation queries', async () => {
    const { service, schemes, getRepository, scheme } = fixture();
    schemes.findOne.mockResolvedValueOnce(null);
    const missing = await service.getStudentGradeSummary(2, 7);
    expect(missing.scheme).toBeNull();
    expect(missing.students.every((student) => student.totalRaw === null)).toBe(true);
    expect(getRepository).toHaveBeenCalledTimes(1);
    scheme.details = [];
    expect((await service.getStudentGradeSummary(2, 7)).scheme?.details).toEqual([]);
    expect(getRepository).toHaveBeenCalledTimes(2);
  });
  it.each([2, 50, 150])('executes the same aggregation queries for %s students', async (count) => {
    const f = fixture(count);
    const result = await f.service.getStudentGradeSummary(2, 7);
    expect(result.students).toHaveLength(count);
    expect(result.students.map((student) => student.idEnrollment)).toEqual(
      Array.from({ length: count }, (_, index) => index + 10),
    );
    expect(f.getRepository).toHaveBeenCalledTimes(5);
    for (const query of [f.activities, f.grades, f.attendances])
      expect(query.getRawMany).toHaveBeenCalledTimes(1);
    expect(f.sessions.countBy).toHaveBeenCalledTimes(1);
    expect(f.grades.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('activity.deletedAt IS NULL'),
    );
    expect(f.grades.andWhere).toHaveBeenCalledWith(expect.stringContaining('IN (:...studentIds)'), {
      studentIds: result.students.map((student) => student.idEnrollment),
    });
  });
  it('reuses access validation and does not query grades on denied access', async () => {
    const { service, getRepository } = fixture();
    jest.spyOn(service, 'getStudentsByEnrollment').mockRejectedValue(new ForbiddenException());
    await expect(service.getStudentGradeSummary(3, 7)).rejects.toThrow(ForbiddenException);
    expect(getRepository).not.toHaveBeenCalled();
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        Object.getOwnPropertyDescriptor(EnrollmentsController.prototype, 'getStudentGradeSummary')
          ?.value as object,
      ),
    ).toEqual(['grade.get-by-enrollment']);
  });
  it('retains partial activity grading and absence attendance rules', () => {
    expect(averageScores([90, 70])).toBe(80);
    expect(averageScores([])).toBeNull();
    expect(attendancePercentage(4, 5)).toBe(80);
    expect(attendancePercentage(0, 0)).toBe(0);
    expect(criterionScore({ activityCount: 3, activityScore: 80, directScore: 100 })).toBe(80);
    expect(criterionScore({ activityCount: 0, activityScore: null, directScore: 75 })).toBe(75);
    expect(
      totalScore([
        { score: null, percentage: 60 },
        { score: 80, percentage: 40 },
      ]),
    ).toBe(32);
    expect(weightedScore(85, 20)).toBe(17);
  });
});
