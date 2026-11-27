import { attendanceAcademicDate } from '@common/utils/attendance-session-policy';
import { ForbiddenException } from '@nestjs/common';
import { Repository, EntityManager } from 'typeorm';
import type { DeepPartial } from 'typeorm';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceRegistrationMethod as Method } from '@common/enums/attendanceRegistrationMethod';
import { AttendanceStatus } from '@common/enums/attendanceStatus';
import { CourseRelations } from '@common/enums/courseRelations';
import { createValidationPipe } from '@core/pipes/validation.pipe';
import { AttendanceSessionCreateDto } from 'src/dtos/attendances/attendance-session-create.dto';
import { AttendanceSessionUpdateDto } from 'src/dtos/attendances/attendance-session-update.dto';
import { AttendanceSaveDto } from 'src/dtos/attendances/attendance-save.dto';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendancesService } from './attendances.service';

function fixture(mode = Mode.MANUAL) {
  const assistant = {
    idEnrollment: 10,
    user: { idUser: 2 },
    course: { idCourse: 3 },
    semester: { idSemester: 4 },
    role: CourseRelations.ASSISTANT,
    isActive: true,
  };
  const session = {
    idAttendanceSession: 1,
    mode,
    date: '2026-10-25',
    assistantEnrollment: assistant,
    attendances: [],
  };
  const sessions = {
    findOne: jest.fn().mockResolvedValue(session),
    create: jest.fn((value: unknown) => value),
    save: jest.fn((value: unknown) => Promise.resolve(value)),
  };
  const records = {
    find: jest.fn<Promise<DeepPartial<Attendance>[]>, []>().mockResolvedValue([]),
    upsert: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    manager: { transaction: jest.fn() },
  };
  const enrollments = {
    findOne: jest.fn().mockResolvedValue(assistant),
    find: jest.fn().mockResolvedValue([{ idEnrollment: 5 }]),
  };
  const service = new AttendancesService(
    sessions as unknown as Repository<AttendanceSession>,
    records as unknown as Repository<Attendance>,
    enrollments as unknown as Repository<Enrollment>,
  );
  return { service, sessions, records, enrollments, session };
}

describe('Attendance compatibility and protected mutation boundary', () => {
  it.each(['latitude', 'openedAt', 'closedAt', 'cancelledAt'])(
    'does not expose session field %s in create DTO',
    async (field) => {
      const dto: unknown = await createValidationPipe().transform(
        {
          enrollmentId: 10,
          date: '2026-10-25',
          [field]: field === 'mode' ? 'GEOLOCATION' : '2026-10-25T14:00:00Z',
        },
        { type: 'body', metatype: AttendanceSessionCreateDto },
      );
      expect(dto).toEqual({ enrollmentId: 10, date: '2026-10-25' });
    },
  );

  it('keeps update date-only and strips evidence from nested save DTO', async () => {
    const pipe = createValidationPipe();
    expect(
      await pipe.transform(
        { date: '2026-10-26', mode: 'GEOLOCATION', openedAt: new Date().toISOString() },
        { type: 'body', metatype: AttendanceSessionUpdateDto },
      ),
    ).toEqual({ date: '2026-10-26' });
    const dto: unknown = await pipe.transform(
      {
        attendances: [
          {
            enrollmentId: 5,
            status: 'PRESENT',
            registrationMethod: 'GEOLOCATION',
            markedAt: new Date().toISOString(),
            markedBy: 8,
            accuracy: 0,
            distanceMeters: 0,
          },
        ],
      },
      { type: 'body', metatype: AttendanceSaveDto },
    );
    expect(dto).toEqual({ attendances: [{ enrollmentId: 5, status: 'PRESENT' }] });
  });

  it('creates sessions using only explicitly mapped fields with an absent topic', async () => {
    const f = fixture();
    f.sessions.findOne.mockResolvedValueOnce(null);
    const date = attendanceAcademicDate(new Date());
    await f.service.createSession(2, { enrollmentId: 10, date });
    expect(f.sessions.create).toHaveBeenCalledWith({
      assistantEnrollment: f.session.assistantEnrollment,
      date,
      topic: null,
    });
  });

  it.each(['get', 'delete-mark'])('blocks GEO session operation %s', async (operation) => {
    const f = fixture(Mode.GEOLOCATION);
    const actions: Record<string, () => Promise<unknown>> = {
      get: () => f.service.getSession(2, 1),
      save: () => f.service.saveAttendances(2, 1, { attendances: [] }),
      update: () => f.service.updateSession(2, 1, { date: '2026-10-26' }),
      delete: () => f.service.deleteSession(2, 1),
      'delete-mark': () => f.service.deleteAttendance(2, 1, 5),
    };
    await expect(actions[operation]()).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.sessions.save).not.toHaveBeenCalled();
    expect(f.records.delete).not.toHaveBeenCalled();
    expect(f.records.manager.transaction).not.toHaveBeenCalled();
  });

  it('keeps date edits and manual mark deletion available', async () => {
    const f = fixture();
    await expect(f.service.updateSession(2, 1, { date: '2026-10-26' })).resolves.toMatchObject({
      date: '2026-10-26',
    });
    await f.service.deleteAttendance(2, 1, 5);
    expect(f.records.delete).toHaveBeenCalledWith({
      attendanceSession: { idAttendanceSession: 1 },
      enrollment: { idEnrollment: 5 },
      registrationMethod: Method.MANUAL,
    });
  });

  it.each([Method.GEOLOCATION, Method.QR])(
    'does not overwrite %s evidence even if attached to a MANUAL session',
    async (method) => {
      const f = fixture();
      f.records.find.mockResolvedValue([
        { registrationMethod: method, enrollment: { idEnrollment: 5 } },
      ]);
      const manager = {
        getRepository: (entity: unknown) =>
          entity === Attendance
            ? f.records
            : { findOneOrFail: jest.fn().mockResolvedValue(f.session) },
      };
      f.records.manager.transaction.mockImplementation(
        (callback: (value: EntityManager) => Promise<unknown>) =>
          callback(manager as unknown as EntityManager),
      );
      await expect(
        f.service.saveAttendances(2, 1, {
          attendances: [{ enrollmentId: 5, status: AttendanceStatus.PRESENT }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(f.records.upsert).not.toHaveBeenCalled();
    },
  );

  it.each(['update', 'delete', 'delete-mark'])(
    'blocks %s of QR evidence in a MANUAL session',
    async (operation) => {
      const f = fixture();
      Object.assign(f.session, { attendances: [{ registrationMethod: Method.QR }] });
      const actions: Record<string, () => Promise<unknown>> = {
        update: () => f.service.updateSession(2, 1, { date: '2026-10-26' }),
        delete: () => f.service.deleteSession(2, 1),
        'delete-mark': () => f.service.deleteAttendance(2, 1, 5),
      };
      await expect(actions[operation]()).rejects.toBeInstanceOf(ForbiddenException);
      expect(f.sessions.save).not.toHaveBeenCalled();
      expect(f.records.delete).not.toHaveBeenCalled();
    },
  );

  it('does not overwrite QR with markAll or accept injected QR mode on date updates', async () => {
    const f = fixture();
    f.records.find.mockResolvedValue([
      { registrationMethod: Method.QR, enrollment: { idEnrollment: 5 } },
    ]);
    const manager = {
      getRepository: (entity: unknown) =>
        entity === Attendance
          ? f.records
          : { findOneOrFail: jest.fn().mockResolvedValue(f.session) },
    };
    f.records.manager.transaction.mockImplementation(
      (callback: (value: EntityManager) => Promise<unknown>) =>
        callback(manager as unknown as EntityManager),
    );
    await expect(
      f.service.saveAttendances(2, 1, { attendances: [], markAll: AttendanceStatus.PRESENT }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.records.upsert).not.toHaveBeenCalled();
    const dto: unknown = await createValidationPipe().transform(
      { date: '2026-10-26', mode: 'QR' },
      { type: 'body', metatype: AttendanceSessionUpdateDto },
    );
    expect(dto).toEqual({ date: '2026-10-26' });
    await f.service.updateSession(2, 1, { date: '2026-10-26' });
    expect(f.session.mode).toBe(Mode.MANUAL);
  });
});
