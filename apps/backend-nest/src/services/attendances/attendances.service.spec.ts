import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { AttendanceStatus as S } from '@common/enums/attendanceStatus';
import { CourseRelations } from '@common/enums/courseRelations';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendancesService } from './attendances.service';

function fixture(statuses: S[] = [], total = 9, weight = 0.5) {
  const assistant = {
    idEnrollment: 20,
    user: { idUser: 2 },
    course: { idCourse: 3 },
    semester: { idSemester: 4 },
    role: CourseRelations.ASSISTANT,
    isActive: true,
  };
  const student = {
    idEnrollment: 1,
    user: { idUser: 5 },
    course: assistant.course,
    semester: assistant.semester,
  };
  const session = {
    idAttendanceSession: 1,
    date: new Date('2026-10-10'),
    assistantEnrollment: assistant,
    attendances: statuses.map((status, index) => ({
      status,
      enrollment: { idEnrollment: index + 1 },
    })),
  };
  const sessions = {
    find: jest.fn().mockResolvedValue([session]),
    findAndCount: jest.fn().mockResolvedValue([[session], 1]),
    findOne: jest.fn().mockResolvedValue(session),
  };
  const schemes = {
    findOne: jest.fn().mockResolvedValue({
      details: [{ permissionWeight: weight, gradeItem: { name: 'Asistencias' } }],
    }),
  };
  const enrollments = {
    findOne: jest.fn().mockResolvedValue(assistant),
    find: jest
      .fn()
      .mockResolvedValue(
        Array.from({ length: total }, (_, index) => ({ idEnrollment: index + 1 })),
      ),
    manager: { getRepository: jest.fn(() => schemes) },
  };
  const attendances = { manager: { transaction: jest.fn() } };
  const service = new AttendancesService(
    sessions as unknown as Repository<AttendanceSession>,
    attendances as unknown as Repository<Attendance>,
    enrollments as unknown as Repository<Enrollment>,
  );
  return { service, sessions, enrollments, attendances, assistant, student, session };
}

describe('AttendancesService', () => {
  it('returns only the owning student summary using existing attendance weights', async () => {
    const f = fixture([], 9, 0.5);
    f.enrollments.findOne.mockResolvedValueOnce(f.student);
    f.enrollments.find.mockResolvedValue([f.assistant]);
    f.sessions.find.mockResolvedValue(
      [S.PRESENT, S.EXCUSED, S.ABSENT].map((status) => ({
        ...f.session,
        attendances: [{ status, enrollment: { idEnrollment: 1 } }],
      })),
    );
    const result = await f.service.getMyStudentAttendance(5, 1);
    expect(result).toMatchObject({
      totalSessions: 3,
      presentSessions: 1,
      excusedSessions: 1,
      absentSessions: 1,
    });
    expect(result.percentage).toBe(50);
    expect(f.sessions.find).toHaveBeenCalledTimes(1);
  });
  it('rejects querying another student before reading attendance sessions', async () => {
    const f = fixture();
    f.enrollments.findOne.mockResolvedValueOnce(f.student);
    await expect(f.service.getMyStudentAttendance(99, 1)).rejects.toThrow(ForbiddenException);
    expect(f.sessions.find).not.toHaveBeenCalled();
  });
  it('does not silently select one assistant when ownership scope is ambiguous', async () => {
    const f = fixture();
    f.enrollments.findOne.mockResolvedValueOnce(f.student);
    f.enrollments.find.mockResolvedValue([f.assistant, { ...f.assistant, idEnrollment: 21 }]);
    await expect(f.service.getMyStudentAttendance(5, 1)).rejects.toThrow(BadRequestException);
    expect(f.sessions.find).not.toHaveBeenCalled();
  });
  it('returns no sessions for an owned enrollment without an active assistant', async () => {
    const f = fixture();
    f.enrollments.findOne.mockResolvedValueOnce(f.student);
    f.enrollments.find.mockResolvedValue([]);
    expect(await f.service.getMyStudentAttendance(5, 1)).toMatchObject({
      totalSessions: 0,
      percentage: 0,
    });
  });
  it('returns roster totals, permissions and implicit absences in both history endpoints', async () => {
    const f = fixture([S.PRESENT, S.PRESENT, S.PRESENT, S.EXCUSED, S.ABSENT, S.ABSENT]);
    f.session.attendances.push({ status: S.PRESENT, enrollment: { idEnrollment: 999 } });
    const list = await f.service.getSessionsByEnrollment(2, 20);
    const page = await f.service.getSessionsPage(2, 20, { page: 1 });
    expect(page.data).toEqual(list);
    expect(list[0]).toMatchObject({
      presentCount: 3,
      excusedCount: 1,
      absentCount: 5,
      totalStudents: 9,
    });
    expect(list[0].percentage).toBeCloseTo((3.5 / 9) * 100, 8);
  });
  it('counts every student absent in an empty session', async () => {
    expect((await fixture().service.getSessionsByEnrollment(2, 20))[0]).toMatchObject({
      absentCount: 9,
      percentage: 0,
    });
  });
  it.each([1, 0.5, 0])('applies criterion weight %s in the individual summary', async (weight) => {
    const f = fixture([], 1, weight);
    f.enrollments.findOne.mockResolvedValueOnce(f.student).mockResolvedValueOnce(f.assistant);
    f.sessions.find.mockResolvedValue(
      [S.PRESENT, S.PRESENT, S.PRESENT, S.PRESENT, S.PRESENT, S.EXCUSED, S.ABSENT].map(
        (status) => ({ ...f.session, attendances: [{ status, enrollment: { idEnrollment: 1 } }] }),
      ),
    );
    const result = await f.service.getStudentAttendance(2, 1);
    expect(result).toMatchObject({
      presentSessions: 5,
      excusedSessions: 1,
      absentSessions: 1,
      totalSessions: 7,
    });
    expect(result.percentage).toBeCloseTo(((5 + weight) / 7) * 100, 8);
  });
  it('includes missing attendance in the individual absence count', async () => {
    const f = fixture();
    f.enrollments.findOne.mockResolvedValueOnce(f.student).mockResolvedValueOnce(f.assistant);
    f.sessions.find.mockResolvedValue(
      [S.PRESENT, S.PRESENT, S.PRESENT, S.ABSENT, null, null, null].map((status) => ({
        ...f.session,
        attendances: status ? [{ status, enrollment: { idEnrollment: 1 } }] : [],
      })),
    );
    expect(await f.service.getStudentAttendance(2, 1)).toMatchObject({
      presentSessions: 3,
      excusedSessions: 0,
      absentSessions: 4,
      totalSessions: 7,
    });
  });
  it.each([S.PRESENT, S.EXCUSED, S.ABSENT])(
    'persists %s through the existing locked transaction',
    async (status) => {
      const f = fixture();
      const record = { status: S.ABSENT, enrollment: { idEnrollment: 1 } };
      const repository = {
        findOne: jest.fn().mockResolvedValue(record),
        save: jest.fn().mockImplementation((value: Attendance) => Promise.resolve(value)),
      };
      const lock = { findOneOrFail: jest.fn().mockResolvedValue(f.session) };
      const manager = {
        getRepository: jest.fn((entity: unknown) => (entity === Attendance ? repository : lock)),
      };
      f.attendances.manager.transaction.mockImplementation(
        (callback: (manager: EntityManager) => Promise<Attendance[]>) =>
          callback(manager as unknown as EntityManager),
      );
      const saved = await f.service.saveAttendances(2, 1, {
        attendances: [{ enrollmentId: 1, status }],
      });
      expect(saved[0].status).toBe(status);
      expect(saved[0].enrollment.idEnrollment).toBe(1);
      expect(repository.findOne).toHaveBeenCalledWith({
        relations: { enrollment: true },
        where: {
          attendanceSession: { idAttendanceSession: 1 },
          enrollment: { idEnrollment: 1 },
        },
      });
      expect(lock.findOneOrFail).toHaveBeenCalledWith({
        where: { idAttendanceSession: 1 },
        lock: { mode: 'pessimistic_write' },
      });
    },
  );
  it.each([undefined, null, '', '  Cita médica  '])(
    'preserves or updates the optional observation %s',
    async (observation) => {
      const f = fixture();
      const record = { status: S.EXCUSED, observation: 'Anterior' };
      const repository = {
        findOne: jest.fn().mockResolvedValue(record),
        save: jest.fn().mockImplementation((value: Attendance) => Promise.resolve(value)),
      };
      const manager = {
        getRepository: jest.fn((entity: unknown) =>
          entity === Attendance
            ? repository
            : { findOneOrFail: jest.fn().mockResolvedValue(f.session) },
        ),
      };
      f.attendances.manager.transaction.mockImplementation(
        (callback: (manager: EntityManager) => Promise<Attendance[]>) =>
          callback(manager as unknown as EntityManager),
      );
      const saved = await f.service.saveAttendances(2, 1, {
        attendances: [{ enrollmentId: 1, status: S.EXCUSED, observation }],
      });
      expect(saved[0].observation).toBe(
        observation === undefined ? 'Anterior' : observation?.trim() || null,
      );
    },
  );
  it.each([S.PRESENT, S.ABSENT])(
    'clears stale and incoming observations for %s',
    async (status) => {
      for (const observation of [undefined, null, 'Cita médica']) {
        const f = fixture();
        const record = { status: S.EXCUSED, observation: 'Anterior' };
        const repository = {
          findOne: jest.fn().mockResolvedValue(record),
          save: jest.fn().mockImplementation((value: Attendance) => Promise.resolve(value)),
        };
        const manager = {
          getRepository: jest.fn((entity: unknown) =>
            entity === Attendance
              ? repository
              : { findOneOrFail: jest.fn().mockResolvedValue(f.session) },
          ),
        };
        f.attendances.manager.transaction.mockImplementation(
          (callback: (manager: EntityManager) => Promise<Attendance[]>) =>
            callback(manager as unknown as EntityManager),
        );
        const saved = await f.service.saveAttendances(2, 1, {
          attendances: [{ enrollmentId: 1, status, observation }],
        });
        expect(saved[0].observation).toBeNull();
      }
    },
  );
  it('rejects foreign student IDs before writing', async () => {
    const f = fixture();
    await expect(
      f.service.saveAttendances(2, 1, { attendances: [{ enrollmentId: 999, status: S.EXCUSED }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.attendances.manager.transaction).not.toHaveBeenCalled();
  });
  it('rejects duplicate IDs before writing', async () => {
    const f = fixture();
    await expect(
      f.service.saveAttendances(2, 1, {
        attendances: [
          { enrollmentId: 1, status: S.PRESENT },
          { enrollmentId: 1, status: S.EXCUSED },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects another assistant session', async () => {
    await expect(
      fixture().service.saveAttendances(99, 1, { attendances: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
