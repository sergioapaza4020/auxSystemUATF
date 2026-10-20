import { In } from 'typeorm';
import * as roster from '@common/utils/student-roster';
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
    countBy: jest.fn().mockResolvedValue(0),
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
  const aggregate = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ present: '0', excused: '0' }),
  };
  const attendances = {
    manager: { transaction: jest.fn() },
    createQueryBuilder: jest.fn(() => aggregate),
  };
  const service = new AttendancesService(
    sessions as unknown as Repository<AttendanceSession>,
    attendances as unknown as Repository<Attendance>,
    enrollments as unknown as Repository<Enrollment>,
  );
  return { service, sessions, enrollments, attendances, assistant, student, session, aggregate };
}

describe('AttendancesService', () => {
  it('returns only the owning student summary using existing attendance weights', async () => {
    const f = fixture([], 9, 0.5);
    f.enrollments.findOne.mockResolvedValueOnce(f.student);
    f.enrollments.find.mockResolvedValue([f.assistant]);
    f.sessions.countBy.mockResolvedValue(3);
    f.aggregate.getRawOne.mockResolvedValue({ present: '1', excused: '1' });
    const result = await f.service.getMyStudentAttendance(5, 1);
    expect(result).toMatchObject({
      totalSessions: 3,
      presentSessions: 1,
      excusedSessions: 1,
      absentSessions: 1,
    });
    expect(result.percentage).toBe(50);
    expect(f.sessions.find).not.toHaveBeenCalled();
    expect(f.sessions.countBy).toHaveBeenCalledWith({ assistantEnrollment: { idEnrollment: 20 } });
    expect(f.aggregate.andWhere).toHaveBeenCalledWith('attendance.id_enrollment = :studentId', {
      studentId: 1,
    });
    expect(f.aggregate.where).toHaveBeenCalledWith(
      'session.id_assistant_enrollment = :assistantId',
      { assistantId: 20 },
    );
  });
  it.each([
    { total: 0, statuses: [] },
    { total: 4, statuses: [S.PRESENT, S.PRESENT, S.PRESENT, S.PRESENT] },
    { total: 10, statuses: [S.PRESENT, S.PRESENT, S.PRESENT, S.EXCUSED] },
    { total: 3, statuses: [S.PRESENT, S.ABSENT] },
  ])('matches the previous algorithm for $total sessions', async ({ total, statuses }) => {
    const f = fixture([], 1, 0.333);
    f.enrollments.findOne.mockResolvedValueOnce(f.student).mockResolvedValueOnce(f.assistant);
    f.sessions.countBy.mockResolvedValue(total);
    const present = statuses.filter((status) => status === S.PRESENT).length;
    const excused = statuses.filter((status) => status === S.EXCUSED).length;
    f.aggregate.getRawOne.mockResolvedValue({ present: String(present), excused: String(excused) });
    const result = await f.service.getStudentAttendance(2, 1);
    expect(result).toEqual({
      totalSessions: total,
      presentSessions: present,
      excusedSessions: excused,
      absentSessions: total - present - excused,
      percentage: total ? ((present + excused * 0.333) / total) * 100 : 0,
    });
    expect(f.sessions.find).not.toHaveBeenCalled();
    expect(f.enrollments.find).not.toHaveBeenCalled();
    expect(f.aggregate.select).not.toHaveBeenCalledWith(expect.stringContaining('observation'));
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
  it.each([1, 0.5, 0.333, 0])(
    'applies criterion weight %s in the individual summary',
    async (weight) => {
      const f = fixture([], 1, weight);
      f.enrollments.findOne.mockResolvedValueOnce(f.student).mockResolvedValueOnce(f.assistant);
      f.sessions.countBy.mockResolvedValue(7);
      f.aggregate.getRawOne.mockResolvedValue({ present: '5', excused: '1' });
      const result = await f.service.getStudentAttendance(2, 1);
      expect(result).toMatchObject({
        presentSessions: 5,
        excusedSessions: 1,
        absentSessions: 1,
        totalSessions: 7,
      });
      expect(result.percentage).toBeCloseTo(((5 + weight) / 7) * 100, 8);
    },
  );
  it('includes missing attendance in the individual absence count', async () => {
    const f = fixture();
    f.enrollments.findOne.mockResolvedValueOnce(f.student).mockResolvedValueOnce(f.assistant);
    f.sessions.countBy.mockResolvedValue(7);
    f.aggregate.getRawOne.mockResolvedValue({ present: '3', excused: '0' });
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
        find: jest.fn().mockImplementation(() => Promise.resolve([record])),
        upsert: jest.fn().mockImplementation((values: Attendance[]) => {
          Object.assign(record, values[0]);
          return Promise.resolve();
        }),
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
      expect(repository.find).toHaveBeenCalledWith({
        relations: { enrollment: true },
        where: {
          attendanceSession: { idAttendanceSession: 1 },
          enrollment: { idEnrollment: In([1]) },
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
      const record = {
        status: S.EXCUSED,
        observation: 'Anterior',
        enrollment: { idEnrollment: 1 },
      };
      const repository = {
        find: jest.fn().mockImplementation(() => Promise.resolve([record])),
        upsert: jest.fn().mockImplementation((values: Attendance[]) => {
          Object.assign(record, values[0]);
          return Promise.resolve();
        }),
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
        const record = {
          status: S.EXCUSED,
          observation: 'Anterior',
          enrollment: { idEnrollment: 1 },
        };
        const repository = {
          find: jest.fn().mockImplementation(() => Promise.resolve([record])),
          upsert: jest.fn().mockImplementation((values: Attendance[]) => {
            Object.assign(record, values[0]);
            return Promise.resolve();
          }),
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

describe('paginated session roster', () => {
  afterEach(() => jest.restoreAllMocks());
  it('returns unmarked students and global weighted totals independent of search', async () => {
    const f = fixture();
    const page = [{ idEnrollment: 9, user: { name: 'Ana' } }] as Enrollment[];
    jest
      .spyOn(roster, 'getStudentRosterPage')
      .mockResolvedValue({ data: page, meta: { page: 1, limit: 1, total: 1, totalPages: 1 } });
    jest
      .spyOn(roster, 'buildStudentRosterQuery')
      .mockReturnValue({ getCount: jest.fn().mockResolvedValue(9) } as unknown as ReturnType<
        typeof roster.buildStudentRosterQuery
      >);
    const query = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { status: S.PRESENT, count: '3' },
        { status: S.EXCUSED, count: '2' },
      ]),
    };
    Object.assign(f.attendances, {
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => query),
    });
    const result = await f.service.getSessionPage(2, 1, { page: 1, limit: 1, search: 'Ana' });
    expect(result.data.students).toEqual(page);
    expect(result.data.attendances).toEqual([]); // the client overlays ABSENT on the roster
    expect(result.meta.total).toBe(1);
    expect(result.data).toMatchObject({
      totalStudents: 9,
      presentCount: 3,
      excusedCount: 2,
      absentCount: 4,
    });
    expect(result.data.percentage).toBeCloseTo(400 / 9);
    expect(roster.buildStudentRosterQuery).toHaveBeenCalledWith(f.enrollments, f.assistant);
    expect(query.andWhere).toHaveBeenCalledWith('student.isActive = true');
  });
  it('applies global intent before overrides in one bulk, without creating implicit absences', async () => {
    const f = fixture([], 3);
    const existing = [
      { enrollment: { idEnrollment: 1 }, status: S.EXCUSED, observation: 'Anterior' },
    ];
    const repository = {
      find: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn<Promise<unknown>, [Partial<Attendance>[], string[]]>().mockResolvedValue({}),
    };
    const lock = { findOneOrFail: jest.fn().mockResolvedValue(f.session) };
    const manager = {
      getRepository: (entity: unknown) => (entity === Attendance ? repository : lock),
    };
    f.attendances.manager.transaction.mockImplementation(
      (callback: (manager: EntityManager) => Promise<Attendance[]>) =>
        callback(manager as unknown as EntityManager),
    );
    await f.service.saveAttendances(2, 1, {
      markAll: S.PRESENT,
      attendances: [{ enrollmentId: 2, status: S.EXCUSED, observation: ' Cita ' }],
    });
    expect(repository.upsert).toHaveBeenCalledTimes(1);
    expect(repository.upsert.mock.calls[0][0]).toMatchObject([
      { enrollment: { idEnrollment: 1 }, status: S.PRESENT, observation: null },
      { enrollment: { idEnrollment: 2 }, status: S.EXCUSED, observation: 'Cita' },
      { enrollment: { idEnrollment: 3 }, status: S.PRESENT, observation: null },
    ]);
    repository.upsert.mockClear();
    await f.service.saveAttendances(2, 1, { markAll: S.ABSENT, attendances: [] });
    expect(repository.upsert.mock.calls[0][0]).toMatchObject([
      { enrollment: { idEnrollment: 1 }, status: S.ABSENT, observation: null },
    ]);
    expect(repository.upsert.mock.calls[0][0]).toHaveLength(1);
  });
});
