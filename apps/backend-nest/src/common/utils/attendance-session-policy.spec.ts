import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import { AttendanceSessionState as State } from '@common/enums/attendanceSessionState';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import {
  attendanceAcademicDate,
  getAttendanceSessionState,
  isAttendanceSessionComputable,
} from './attendance-session-policy';

export function geoSession(overrides: Partial<AttendanceSession> = {}): AttendanceSession {
  return Object.assign(
    new AttendanceSession(),
    {
      idAttendanceSession: 1,
      mode: Mode.GEOLOCATION,
      date: '2026-10-25',
      latitude: '-19.5723',
      longitude: '-65.755',
      radiusMeters: 100,
      maximumAcceptedAccuracy: 50,
      startsAt: new Date('2026-10-25T14:00:00Z'),
      endsAt: new Date('2026-10-25T15:00:00Z'),
      openedAt: null,
      closedAt: null,
      cancelledAt: null,
    },
    overrides,
  );
}

describe('Attendance session operational policy', () => {
  const now = new Date('2026-10-25T14:30:00Z');
  const activated = { openedAt: new Date('2026-10-25T13:00:00Z') };
  it('computes closed QR and rejects unknown modes', () => {
    const qr = geoSession({
      mode: Mode.QR,
      latitude: null,
      longitude: null,
      radiusMeters: null,
      maximumAcceptedAccuracy: null,
      ...activated,
      closedAt: new Date('2026-10-25T14:20Z'),
    });
    expect(isAttendanceSessionComputable(qr, now)).toBe(true);
    expect(getAttendanceSessionState(qr, now)).toBe(State.CLOSED);
    const unknown = geoSession();
    Object.assign(unknown, { mode: 'UNKNOWN' });
    expect(() => isAttendanceSessionComputable(unknown, now)).toThrow('SESSION_STRUCTURE_INVALID');
  });
  it('keeps MANUAL computable without assigning an operational state', () => {
    const session = geoSession({ mode: Mode.MANUAL });
    expect(getAttendanceSessionState(session, now)).toBeNull();
    expect(isAttendanceSessionComputable(session, now)).toBe(true);
  });
  it.each([
    [{}, '2026-10-25T16:00:00Z', State.DRAFT, false],
    [activated, '2026-10-25T13:59:59.999Z', State.SCHEDULED, false],
    [activated, '2026-10-25T14:00:00Z', State.OPEN, false],
    [activated, '2026-10-25T14:30:00Z', State.OPEN, false],
    [activated, '2026-10-25T15:00:00Z', State.CLOSED, true],
    [activated, '2026-10-25T16:00:00Z', State.CLOSED, true],
    [
      { ...activated, closedAt: new Date('2026-10-25T14:15:00Z') },
      '2026-10-25T14:30:00Z',
      State.CLOSED,
      true,
    ],
    [
      { cancelledAt: new Date('2026-10-25T12:00:00Z') },
      '2026-10-25T14:30:00Z',
      State.CANCELLED,
      false,
    ],
    [
      { ...activated, cancelledAt: new Date('2026-10-25T13:30:00Z') },
      '2026-10-25T14:30:00Z',
      State.CANCELLED,
      false,
    ],
  ])('resolves state and computability %#', (fields, instant, state, computable) => {
    const session = geoSession(fields);
    const at = new Date(instant);
    expect(getAttendanceSessionState(session, at)).toBe(state);
    expect(isAttendanceSessionComputable(session, at)).toBe(computable);
  });
  it.each([
    { latitude: 'NaN' },
    { longitude: '181' },
    { radiusMeters: 0 },
    { maximumAcceptedAccuracy: 0 },
    { startsAt: new Date('invalid') },
    { endsAt: new Date('2026-10-25T14:00:00Z') },
    { openedAt: now, longitude: null },
    { closedAt: now },
    { ...activated, cancelledAt: now },
    { ...activated, closedAt: new Date('2026-10-25T15:00:00Z') },
    { ...activated, openedAt: new Date('2026-10-25T15:01:00Z') },
  ])('does not turn malformed GEO into a valid state %#', (fields) => {
    expect(() => getAttendanceSessionState(geoSession(fields), now)).toThrow(
      'SESSION_STRUCTURE_INVALID',
    );
  });
  it('derives the academic date in La Paz even across UTC midnight', () => {
    expect(attendanceAcademicDate(new Date('2026-10-26T02:00:00Z'))).toBe('2026-10-25');
    expect(attendanceAcademicDate(new Date('2026-10-26T04:00:00Z'))).toBe('2026-10-26');
  });
});
