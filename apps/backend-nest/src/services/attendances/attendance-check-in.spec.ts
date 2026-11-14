import { EntityManager, Repository, QueryFailedError } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceRegistrationMethod as Method } from '@common/enums/attendanceRegistrationMethod';
import { AttendanceStatus as Status } from '@common/enums/attendanceStatus';
import { CourseRelations } from '@common/enums/courseRelations';
import * as distance from '@common/utils/geolocation-distance';
import { AttendancesService } from './attendances.service';

function fixture() {
  const session: AttendanceSession = Object.assign(new AttendanceSession(), {
    idAttendanceSession: 1,
    mode: Mode.GEOLOCATION,
    date: '2026-10-25',
    latitude: '0.000000',
    longitude: '0.000000',
    radiusMeters: 100,
    maximumAcceptedAccuracy: 50,
    startsAt: new Date('2026-10-25T14:00:00Z'),
    endsAt: new Date('2026-10-25T15:00:00Z'),
    openedAt: new Date('2026-10-25T13:00:00Z'),
    closedAt: null,
    cancelledAt: null,
    assistantEnrollment: {
      idEnrollment: 11,
      user: { idUser: 3 },
      course: { idCourse: 5 },
      semester: { idSemester: 6 },
      isActive: true,
      role: CourseRelations.ASSISTANT,
    },
  });
  const sessions = {
    findOne: jest.fn<Promise<AttendanceSession | null>, [unknown]>().mockResolvedValue(session),
    manager: { transaction: jest.fn() },
  };
  const records = {
    findOne: jest.fn<Promise<Attendance | null>, [unknown]>().mockResolvedValue(null),
    create: jest.fn((value: DeepPartial<Attendance>) => Object.assign(new Attendance(), value)),
    save: jest.fn((value: Attendance) =>
      Promise.resolve(Object.assign(value, { idAttendance: 99 })),
    ),
  };
  const enrollments = {
    findOne: jest
      .fn<Promise<Partial<Enrollment> | null>, [unknown]>()
      .mockResolvedValue({ idEnrollment: 12 }),
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === AttendanceSession ? sessions : entity === Attendance ? records : enrollments,
  };
  sessions.manager.transaction.mockImplementation(
    (work: (value: EntityManager) => Promise<unknown>) => work(manager as unknown as EntityManager),
  );
  const service = new AttendancesService(
    sessions as unknown as Repository<AttendanceSession>,
    records as unknown as Repository<Attendance>,
    enrollments as unknown as Repository<Enrollment>,
  );
  return { service, session, sessions, records, enrollments };
}

describe('Student check-in service', () => {
  const input = { latitude: 0, longitude: 0, accuracy: 20 };
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-25T14:30:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('resolves own enrollment and inserts only PRESENT GEO evidence with a private response', async () => {
    const f = fixture();
    const response = await f.service.checkIn(4, 1, input);
    expect(f.enrollments.findOne).toHaveBeenCalledWith({
      where: {
        user: { idUser: 4 },
        course: { idCourse: 5 },
        semester: { idSemester: 6 },
        role: CourseRelations.STUDENT,
        isActive: true,
      },
    });
    expect(f.records.create).toHaveBeenCalledWith({
      attendanceSession: { idAttendanceSession: 1 },
      enrollment: { idEnrollment: 12 },
      status: Status.PRESENT,
      registrationMethod: Method.GEOLOCATION,
      markedAt: new Date(),
      markedBy: { idUser: 4 },
      accuracy: '20.00',
      distanceMeters: '0.00',
    });
    expect(response).toEqual({
      code: 'SUCCESS',
      idAttendance: 99,
      status: Status.PRESENT,
      registrationMethod: Method.GEOLOCATION,
      markedAt: new Date(),
    });
    expect(f.sessions.findOne).toHaveBeenNthCalledWith(1, {
      where: { idAttendanceSession: 1 },
      lock: { mode: 'pessimistic_write' },
    });
  });
  it('captures markedAt after waiting for the shared session lock', async () => {
    const f = fixture();
    f.sessions.findOne.mockImplementation((options: unknown) => {
      if (typeof options === 'object' && options && 'lock' in options)
        jest.setSystemTime(new Date('2026-10-25T14:31:00Z'));
      return Promise.resolve(f.session);
    });
    expect((await f.service.checkIn(4, 1, input)).markedAt).toEqual(
      new Date('2026-10-25T14:31:00Z'),
    );
  });
  it.each([0, 50])('accepts accuracy %s including the exact configured limit', async (accuracy) => {
    const f = fixture();
    await f.service.checkIn(4, 1, { ...input, accuracy });
    expect(f.records.create.mock.calls[0][0]).toMatchObject({ accuracy: accuracy.toFixed(2) });
  });
  it('rejects low accuracy without widening the geofence', async () => {
    const f = fixture();
    await expect(f.service.checkIn(4, 1, { ...input, accuracy: 50.0001 })).rejects.toMatchObject({
      response: { code: 'LOW_ACCURACY' },
      status: 422,
    });
    expect(f.records.save).not.toHaveBeenCalled();
  });
  it('accepts exact radius without rounding but rejects a fraction beyond it', async () => {
    const f = fixture();
    const calculation = jest.spyOn(distance, 'calculateDistanceMeters').mockReturnValue(100);
    await f.service.checkIn(4, 1, input);
    expect(f.records.create.mock.calls[0][0]).toMatchObject({ distanceMeters: '100.00' });
    f.records.save.mockClear();
    calculation.mockReturnValue(100.000001);
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code: 'OUTSIDE_AREA' },
      status: 422,
    });
    expect(f.records.save).not.toHaveBeenCalled();
  });
  it('rejects a real outside position without persisting it', async () => {
    const f = fixture();
    await expect(f.service.checkIn(4, 1, { ...input, longitude: 1 })).rejects.toMatchObject({
      response: { code: 'OUTSIDE_AREA' },
      status: 422,
    });
    expect(f.records.save).not.toHaveBeenCalled();
  });
  it.each([
    ['draft', 'SESSION_NOT_STARTED'],
    ['scheduled', 'SESSION_NOT_STARTED'],
    ['time-closed', 'SESSION_CLOSED'],
    ['manually-closed', 'SESSION_CLOSED'],
    ['cancelled', 'SESSION_CANCELLED'],
    ['manual', 'SESSION_NOT_GEOLOCATION'],
  ])('rejects %s', async (state, code) => {
    const f = fixture();
    if (state === 'draft') f.session.openedAt = null;
    if (state === 'scheduled') jest.setSystemTime(new Date('2026-10-25T13:30:00Z'));
    if (state === 'time-closed') jest.setSystemTime(new Date('2026-10-25T15:00:00Z'));
    if (state === 'manually-closed') f.session.closedAt = new Date('2026-10-25T14:15:00Z');
    if (state === 'cancelled') f.session.cancelledAt = new Date('2026-10-25T13:15:00Z');
    if (state === 'manual') f.session.mode = Mode.MANUAL;
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code },
      status: 409,
    });
    expect(f.records.save).not.toHaveBeenCalled();
  });
  it.each([Status.PRESENT, Status.EXCUSED, Status.ABSENT])(
    'never overwrites a prior manual %s',
    async (status) => {
      const f = fixture();
      f.records.findOne.mockResolvedValue(
        Object.assign(new Attendance(), { status, registrationMethod: Method.MANUAL }),
      );
      await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
        response: { code: 'ALREADY_REGISTERED' },
        status: 409,
      });
      expect(f.records.save).not.toHaveBeenCalled();
    },
  );
  it('never overwrites prior GEO evidence', async () => {
    const f = fixture();
    f.records.findOne.mockResolvedValue(
      Object.assign(new Attendance(), {
        status: Status.PRESENT,
        registrationMethod: Method.GEOLOCATION,
      }),
    );
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code: 'ALREADY_REGISTERED' },
      status: 409,
    });
  });
  it('rejects missing/ineligible enrollment using the full academic scope', async () => {
    const f = fixture();
    f.enrollments.findOne.mockResolvedValue(null);
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code: 'NOT_ENROLLED' },
      status: 403,
    });
  });
  it('rejects a missing session and inactive assistant', async () => {
    const f = fixture();
    f.sessions.findOne.mockResolvedValueOnce(null);
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code: 'SESSION_NOT_FOUND' },
      status: 404,
    });
    f.session.assistantEnrollment.isActive = false;
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code: 'SESSION_CONTEXT_INVALID' },
    });
  });
  it('fails closed on incomplete OPEN configuration', async () => {
    const f = fixture();
    f.session.latitude = null;
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code: 'SESSION_CONTEXT_INVALID' },
      status: 500,
    });
  });
  it('translates the unique constraint defense into ALREADY_REGISTERED', async () => {
    const f = fixture();
    f.records.save.mockRejectedValue(
      new QueryFailedError(
        'INSERT',
        [],
        Object.assign(new Error('unique'), {
          code: '23505',
          constraint: 'UQ_7880aee9d2b1416261167c83e86',
        }),
      ),
    );
    await expect(f.service.checkIn(4, 1, input)).rejects.toMatchObject({
      response: { code: 'ALREADY_REGISTERED' },
      status: 409,
    });
  });
});
