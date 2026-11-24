import { attendanceAcademicDate } from '@common/utils/attendance-session-policy';
import { EntityManager, Repository } from 'typeorm';
import { AttendancesService } from './attendances.service';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { Attendance } from 'src/entities/attendance/attendance.entity';
import { Enrollment } from 'src/entities/enrollments/enrollments.entity';
import { AttendanceQrTokenService } from './attendance-qr-token.service';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';

describe('QR entry read-only mode discovery', () => {
  it.each([Mode.QR, Mode.GEOLOCATION_QR])(
    'returns authoritative %s without creating marks or authorizations',
    async (mode) => {
      const now = new Date();
      const session = Object.assign(new AttendanceSession(), {
        idAttendanceSession: 7,
        mode,
        latitude: mode === Mode.GEOLOCATION_QR ? '-19.57' : null,
        longitude: mode === Mode.GEOLOCATION_QR ? '-65.75' : null,
        radiusMeters: mode === Mode.GEOLOCATION_QR ? 100 : null,
        maximumAcceptedAccuracy: mode === Mode.GEOLOCATION_QR ? 50 : null,
        date: attendanceAcademicDate(now),
        openedAt: now,
        startsAt: new Date(now.getTime() - 10000),
        endsAt: new Date(now.getTime() + 60000),
        closedAt: null,
        cancelledAt: null,
        assistantEnrollment: { course: { name: 'Materia', group: 1 } },
      });
      const save = jest.fn();
      const getRepository = jest.fn(() => ({
        findOne: jest.fn().mockResolvedValue(session),
        save,
      }));
      const manager = { getRepository } as unknown as EntityManager;
      const sessions = {
        manager: {
          transaction: async (work: (transaction: EntityManager) => Promise<unknown>) =>
            work(manager),
        },
      } as unknown as Repository<AttendanceSession>;
      const tokens = {
        verify: jest.fn(() => ({})),
        validatePeriod: jest.fn(() => new Date(now.getTime() + 35000)),
      } as unknown as AttendanceQrTokenService;
      const service = new AttendancesService(
        sessions,
        {} as Repository<Attendance>,
        {} as Repository<Enrollment>,
        tokens,
      );
      const eligibility = jest
        .fn()
        .mockResolvedValue({ session, enrollment: { idEnrollment: 9 }, own: null });
      Object.assign(service, { qrStudentContext: eligibility });
      const token = `q1.test.7.12345.${'A'.repeat(43)}`;
      await expect(service.getQrContext(9, 7, { token })).resolves.toMatchObject({
        mode,
        idAttendanceSession: 7,
        ownMark: null,
        state: 'OPEN',
      });
      expect(eligibility).toHaveBeenCalledWith(manager, 9, 7, [Mode.QR, Mode.GEOLOCATION_QR]);
      expect(getRepository).toHaveBeenCalledTimes(1);
      expect(getRepository).toHaveBeenCalledWith(AttendanceSession);
      expect(save).not.toHaveBeenCalled();
      if (mode === Mode.GEOLOCATION_QR) {
        await expect(service.checkInQr(9, 7, { token })).rejects.toMatchObject({
          response: { code: 'QR_NOT_AVAILABLE' },
        });
        expect(save).not.toHaveBeenCalled();
      }
    },
  );
});
