import { Repository, EntityManager } from 'typeorm';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceSessionState as State } from '@common/enums/attendanceSessionState';
import { AttendanceRegistrationMethod as Method } from '@common/enums/attendanceRegistrationMethod';
import { AttendanceStatus as Status } from '@common/enums/attendanceStatus';
import { CourseRelations } from '@common/enums/courseRelations';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { PERMISSIONS_KEY } from '@core/decorators/permissions/permissions.decorator';
import { AttendanceGeolocationConfigDto } from 'src/dtos/attendances/attendance-geolocation-config.dto';
import { AttendanceSessionCreateDto } from 'src/dtos/attendances/attendance-session-create.dto';
import { AttendancesController } from 'src/controllers/attendances/attendances.controller';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendancesService } from './attendances.service';

function fixture() {
  const session: AttendanceSession = Object.assign(new AttendanceSession(), {
    idAttendanceSession: 1,
    mode: Mode.GEOLOCATION,
    date: '2026-10-25',
    assistantEnrollment: {
      idEnrollment: 10,
      user: { idUser: 2 },
      course: { idCourse: 3 },
      semester: {
        idSemester: 4,
        startDate: new Date('2026-07-27T00:00:00Z'),
        endDate: new Date('2026-12-11T00:00:00Z'),
      },
      role: CourseRelations.ASSISTANT,
      isActive: true,
    },
    latitude: '-19.572300',
    longitude: '-65.755000',
    radiusMeters: 100,
    maximumAcceptedAccuracy: 50,
    startsAt: new Date('2026-10-25T14:00:00Z'),
    endsAt: new Date('2026-10-25T15:00:00Z'),
    openedAt: null,
    closedAt: null,
    cancelledAt: null,
    attendances: [],
  });
  const sessions = {
    findOne: jest
      .fn()
      .mockImplementation((options: { where: { date?: Date } }) =>
        Promise.resolve(options.where.date ? null : session),
      ),
    findOneOrFail: jest.fn().mockResolvedValue(session),
    save: jest.fn().mockImplementation((value: AttendanceSession) => Promise.resolve(value)),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((value: unknown) => value),
    manager: { transaction: jest.fn() },
  };
  const records = {
    countBy: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockResolvedValue([]),
    upsert: jest.fn<Promise<void>, [unknown[], string[]]>().mockResolvedValue(undefined),
  };
  const manager = {
    getRepository: (entity: unknown) => (entity === Attendance ? records : sessions),
  };
  const transaction = (callback: (value: EntityManager) => Promise<unknown>) =>
    callback(manager as unknown as EntityManager);
  sessions.manager.transaction.mockImplementation(transaction);
  const attendances = {
    ...records,
    manager: { transaction: jest.fn().mockImplementation(transaction) },
  };
  const enrollments = {
    find: jest.fn().mockResolvedValue([{ idEnrollment: 5 }]),
    findOne: jest.fn().mockResolvedValue(session.assistantEnrollment),
  };
  const service = new AttendancesService(
    sessions as unknown as Repository<AttendanceSession>,
    attendances as unknown as Repository<Attendance>,
    enrollments as unknown as Repository<Enrollment>,
  );
  return { service, session, sessions, records, attendances };
}

describe('GEO session lifecycle service', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-25T13:30:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('creates an explicitly mapped draft without accepting activation fields', async () => {
    const f = fixture();
    const session = await f.service.createSession(2, {
      enrollmentId: 10,
      date: '2026-10-25',
      mode: Mode.GEOLOCATION,
    });
    expect(session).toMatchObject({
      mode: Mode.GEOLOCATION,
      openedAt: null,
      closedAt: null,
      cancelledAt: null,
    });
  });
  it('derives date from an explicit instant and serializes numeric coordinates', async () => {
    const f = fixture();
    f.session.endsAt = null;
    const response = await f.service.configureGeolocation(2, 1, {
      startsAt: '2026-10-26T02:00:00Z',
      latitude: 0,
      radiusMeters: 120,
    });
    expect(response).toMatchObject({
      date: '2026-10-25',
      latitude: 0,
      radiusMeters: 120,
      state: State.DRAFT,
      isComputable: false,
    });
    expect(
      f.sessions.findOne.mock.calls.some((call: unknown[]) =>
        JSON.stringify(call).includes('pessimistic_write'),
      ),
    ).toBe(true);
  });
  it.each([
    { latitude: 91 },
    { longitude: -181 },
    { radiusMeters: 0 },
    { maximumAcceptedAccuracy: -1 },
    { latitude: Number.NaN },
    { startsAt: '2026-10-25T14:00:00' },
  ])('rejects invalid configuration %#', async (config) => {
    await expect(fixture().service.configureGeolocation(2, 1, config)).rejects.toThrow(
      'GEO_CONFIGURATION_INVALID',
    );
  });
  it('rejects reversed windows before persistence', async () => {
    const f = fixture();
    await expect(
      f.service.configureGeolocation(2, 1, { endsAt: '2026-10-25T14:00:00Z' }),
    ).rejects.toThrow('INVALID_TIME_WINDOW');
    expect(f.sessions.save).not.toHaveBeenCalled();
  });
  it.each([
    ['2026-10-25T13:30:00Z', State.SCHEDULED],
    ['2026-10-25T14:00:00Z', State.OPEN],
    ['2026-10-25T14:30:00Z', State.OPEN],
  ])('activates at %s into %s', async (time, state) => {
    jest.setSystemTime(new Date(time));
    const f = fixture();
    const result = await f.service.activateSession(2, 1);
    expect(result).toMatchObject({ state, openedAt: new Date(time), isComputable: false });
    expect(result.startsAt).toEqual(new Date('2026-10-25T14:00:00Z'));
  });
  it('rejects late activation', async () => {
    jest.setSystemTime(new Date('2026-10-25T15:00:00Z'));
    const f = fixture();
    await expect(f.service.activateSession(2, 1)).rejects.toThrow('SESSION_WINDOW_EXPIRED');
    expect(f.sessions.save).not.toHaveBeenCalled();
  });
  it('rejects incomplete and outside-semester activation', async () => {
    const f = fixture();
    f.session.latitude = null;
    await expect(f.service.activateSession(2, 1)).rejects.toThrow('GEO_CONFIGURATION_INCOMPLETE');
    f.session.latitude = '0';
    f.session.assistantEnrollment.semester.endDate = new Date('2026-10-24T00:00:00Z');
    await expect(f.service.activateSession(2, 1)).rejects.toThrow('OUTSIDE_SEMESTER');
  });
  it('open-now replaces start with the same server instant as openedAt', async () => {
    const f = fixture();
    const response = await f.service.activateSession(2, 1, true);
    expect(response).toMatchObject({
      state: State.OPEN,
      startsAt: new Date(),
      openedAt: new Date(),
      endsAt: new Date('2026-10-25T15:00:00Z'),
    });
  });
  it.each(['configure', 'activate', 'open-now', 'date'])(
    'freezes activated sessions against %s',
    async (operation) => {
      const f = fixture();
      f.session.openedAt = new Date('2026-10-25T13:00:00Z');
      const actions: Record<string, () => Promise<unknown>> = {
        configure: () => f.service.configureGeolocation(2, 1, { latitude: 1 }),
        activate: () => f.service.activateSession(2, 1),
        'open-now': () => f.service.activateSession(2, 1, true),
        date: () => f.service.updateSession(2, 1, { date: '2026-10-26' }),
      };
      await expect(actions[operation]()).rejects.toThrow();
      expect(f.sessions.save).not.toHaveBeenCalled();
    },
  );
  it.each([
    { latitude: 0 },
    { longitude: 0 },
    { radiusMeters: 200 },
    { maximumAcceptedAccuracy: 10 },
    { startsAt: '2026-10-25T14:10:00Z' },
    { endsAt: '2026-10-25T16:00:00Z' },
  ])('freezes each geographical and temporal field after activation %#', async (config) => {
    const f = fixture();
    f.session.openedAt = new Date('2026-10-25T13:00:00Z');
    await expect(f.service.configureGeolocation(2, 1, config)).rejects.toThrow(
      'SESSION_ALREADY_ACTIVATED',
    );
    expect(f.sessions.save).not.toHaveBeenCalled();
  });

  it('closes OPEN without changing endsAt, and does not close twice', async () => {
    jest.setSystemTime(new Date('2026-10-25T14:30:00Z'));
    const f = fixture();
    f.session.openedAt = new Date('2026-10-25T13:00:00Z');
    expect(await f.service.closeSession(2, 1)).toMatchObject({
      state: State.CLOSED,
      isComputable: true,
      closedAt: new Date(),
      endsAt: new Date('2026-10-25T15:00:00Z'),
    });
    await expect(f.service.closeSession(2, 1)).rejects.toThrow('SESSION_ALREADY_CLOSED');
    expect(f.sessions.save).toHaveBeenCalledTimes(1);
  });
  it('does not fabricate manual closure after the time limit', async () => {
    jest.setSystemTime(new Date('2026-10-25T15:00:00Z'));
    const f = fixture();
    f.session.openedAt = new Date('2026-10-25T13:00:00Z');
    await expect(f.service.closeSession(2, 1)).rejects.toThrow('SESSION_ALREADY_CLOSED');
    expect(f.session.closedAt).toBeNull();
  });
  it.each([false, true])(
    'cancels a draft or scheduled session, scheduled=%s',
    async (scheduled) => {
      const f = fixture();
      if (scheduled) f.session.openedAt = new Date('2026-10-25T13:00:00Z');
      expect(await f.service.cancelSession(2, 1)).toMatchObject({
        state: State.CANCELLED,
        isComputable: false,
        cancelledAt: new Date(),
      });
      await expect(f.service.configureGeolocation(2, 1, {})).rejects.toThrow('SESSION_CANCELLED');
    },
  );
  it('rejects cancellation with marks or once OPEN', async () => {
    const f = fixture();
    f.records.countBy.mockResolvedValue(1);
    await expect(f.service.cancelSession(2, 1)).rejects.toThrow('SESSION_HAS_ATTENDANCE');
    f.session.openedAt = new Date('2026-10-25T13:00:00Z');
    jest.setSystemTime(new Date('2026-10-25T14:00:00Z'));
    await expect(f.service.cancelSession(2, 1)).rejects.toThrow('SESSION_CANNOT_CANCEL');
  });
  it('deletes only a clean GEO draft', async () => {
    const f = fixture();
    await f.service.deleteSession(2, 1);
    expect(f.sessions.delete).toHaveBeenCalledWith({ idAttendanceSession: 1 });
    f.records.countBy.mockResolvedValue(1);
    await expect(f.service.deleteSession(2, 1)).rejects.toThrow('SESSION_HAS_ATTENDANCE');
  });
  it.each(['scheduled', 'open', 'closed', 'cancelled'])('does not delete %s', async (state) => {
    const f = fixture();
    f.session.openedAt = new Date('2026-10-25T13:00:00Z');
    if (state === 'open') jest.setSystemTime(new Date('2026-10-25T14:00:00Z'));
    if (state === 'closed') jest.setSystemTime(new Date('2026-10-25T15:00:00Z'));
    if (state === 'cancelled') f.session.cancelledAt = new Date('2026-10-25T13:15:00Z');
    await expect(f.service.deleteSession(2, 1)).rejects.toThrow('SESSION_CANNOT_DELETE');
    expect(f.sessions.delete).not.toHaveBeenCalled();
  });
  it('enforces ownership before taking locks', async () => {
    const f = fixture();
    await expect(f.service.activateSession(99, 1)).rejects.toThrow('No tienes permisos');
    expect(f.sessions.manager.transaction).not.toHaveBeenCalled();
  });
  it.each([Status.PRESENT, Status.EXCUSED, Status.ABSENT])(
    'allows manual %s after opening and attributes new marks',
    async (status) => {
      const f = fixture();
      f.session.openedAt = new Date('2026-10-25T13:00:00Z');
      jest.setSystemTime(new Date('2026-10-25T14:10:00Z'));
      await f.service.saveAttendances(2, 1, { attendances: [{ enrollmentId: 5, status }] });
      if (status !== Status.ABSENT)
        expect(f.records.upsert.mock.calls[0][0]).toMatchObject([
          {
            status,
            registrationMethod: Method.MANUAL,
            markedAt: new Date(),
            markedBy: { idUser: 2 },
          },
        ]);
      else expect(f.records.upsert).not.toHaveBeenCalled();
    },
  );
  it('blocks draft marks and protects markAll against any GEO evidence', async () => {
    const f = fixture();
    await expect(f.service.saveAttendances(2, 1, { attendances: [] })).rejects.toThrow(
      'SESSION_NOT_OPEN',
    );
    f.session.openedAt = new Date('2026-10-25T13:00:00Z');
    jest.setSystemTime(new Date('2026-10-25T14:10:00Z'));
    f.records.countBy.mockResolvedValue(1);
    await expect(
      f.service.saveAttendances(2, 1, { markAll: Status.PRESENT, attendances: [] }),
    ).rejects.toThrow('SESSION_HAS_GEO_EVIDENCE');
  });
  it('has no new student permissions on the lifecycle actions', () => {
    for (const name of ['configureGeolocation', 'activate', 'openNow', 'close', 'cancel'] as const)
      expect(Reflect.getMetadata(PERMISSIONS_KEY, AttendancesController.prototype[name])).toEqual([
        'attendance.session.update',
      ]);
  });
  it('accepts mode only at creation and strips server facts from configuration', async () => {
    const pipe = createValidationPipe();
    expect(
      await pipe.transform(
        {
          enrollmentId: 10,
          date: '2026-10-25',
          mode: 'GEOLOCATION',
          openedAt: new Date().toISOString(),
        },
        { type: 'body', metatype: AttendanceSessionCreateDto },
      ),
    ).toEqual({ enrollmentId: 10, date: '2026-10-25', mode: 'GEOLOCATION' });
    expect(
      await pipe.transform(
        {
          latitude: 0,
          mode: 'MANUAL',
          openedAt: new Date().toISOString(),
          state: 'OPEN',
          date: '2026-10-26',
        },
        { type: 'body', metatype: AttendanceGeolocationConfigDto },
      ),
    ).toEqual({ latitude: 0 });
  });
});
