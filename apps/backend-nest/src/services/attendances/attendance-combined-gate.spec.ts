import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttendanceSessionCreateDto } from 'src/dtos/attendances/attendance-session-create.dto';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import {
  getAttendanceSessionState,
  isAttendanceSessionComputable,
} from '@common/utils/attendance-session-policy';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';

describe('COMB-3 enabled contracts', () => {
  it('accepts COMB explicitly without replacing it by the manual default', () => {
    const dto = plainToInstance(AttendanceSessionCreateDto, {
      enrollmentId: 1,
      date: '2026-11-14',
      mode: Mode.GEOLOCATION_QR,
    });
    expect(validateSync(dto)).toEqual([]);
    expect(dto.mode).toBe(Mode.GEOLOCATION_QR);
  });
  it('computes COMB only after closure and still rejects unknown modes', () => {
    const now = new Date('2026-11-19T14:30Z');
    const session: AttendanceSession = Object.assign(new AttendanceSession(), {
      mode: Mode.GEOLOCATION_QR,
      date: '2026-11-19',
      latitude: '-19.57',
      longitude: '-65.75',
      radiusMeters: 100,
      maximumAcceptedAccuracy: 50,
      startsAt: new Date('2026-11-19T14:00Z'),
      endsAt: new Date('2026-11-19T15:00Z'),
      openedAt: new Date('2026-11-19T13:50Z'),
      closedAt: null,
      cancelledAt: null,
    });
    expect(isAttendanceSessionComputable(session, now)).toBe(false);
    session.closedAt = new Date('2026-11-19T14:20Z');
    expect(isAttendanceSessionComputable(session, now)).toBe(true);
    Object.assign(session, { mode: 'UNKNOWN' });
    expect(() => getAttendanceSessionState(session, now)).toThrow('SESSION_STRUCTURE_INVALID');
  });
});
