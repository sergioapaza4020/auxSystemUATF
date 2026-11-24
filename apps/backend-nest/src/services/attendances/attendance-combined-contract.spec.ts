import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AttendanceCombinedCheckInDto } from 'src/dtos/attendances/attendance-combined.dto';
import { AttendanceSession } from 'src/entities/attendance/attendance-session.entity';
import { attendanceLocationEvidence } from '@common/utils/attendance-location';
import * as distance from '@common/utils/geolocation-distance';
import { AttendanceSessionMode as Mode } from '@common/enums/attendanceSessionMode';
import {
  getAttendanceSessionState,
  isAttendanceSessionComputable,
} from '@common/utils/attendance-session-policy';

const session = (): AttendanceSession =>
  Object.assign(new AttendanceSession(), {
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

describe('Combined geographic and temporal contracts', () => {
  afterEach(() => jest.restoreAllMocks());
  it.each([
    [{ openedAt: null }, '2026-11-19T14:30Z', 'DRAFT', false],
    [{}, '2026-11-19T13:55Z', 'SCHEDULED', false],
    [{}, '2026-11-19T14:30Z', 'OPEN', false],
    [{}, '2026-11-19T15:00Z', 'CLOSED', true],
    [{ closedAt: new Date('2026-11-19T14:15Z') }, '2026-11-19T14:30Z', 'CLOSED', true],
    [{ cancelledAt: new Date('2026-11-19T13:55Z') }, '2026-11-19T14:30Z', 'CANCELLED', false],
  ] as const)('preserves state %s at %s', (patch, instant, state, computable) => {
    const value = Object.assign(session(), patch);
    const now = new Date(instant);
    expect(getAttendanceSessionState(value, now)).toBe(state);
    expect(isAttendanceSessionComputable(value, now)).toBe(computable);
  });
  it('accepts boundary equality and compares full distance before rounding evidence', () => {
    const calculated = jest.spyOn(distance, 'calculateDistanceMeters').mockReturnValue(100);
    expect(
      attendanceLocationEvidence(session(), { latitude: -19.57, longitude: -65.75, accuracy: 50 }),
    ).toEqual({ accuracy: '50.00', distanceMeters: '100.00' });
    calculated.mockReturnValue(100.001);
    expect(() =>
      attendanceLocationEvidence(session(), { latitude: -19.57, longitude: -65.75, accuracy: 50 }),
    ).toThrow();
    calculated.mockReturnValue(99.999);
    expect(
      attendanceLocationEvidence(session(), {
        latitude: -19.57,
        longitude: -65.75,
        accuracy: 49.999,
      }),
    ).toEqual({ accuracy: '50.00', distanceMeters: '100.00' });
    expect(() =>
      attendanceLocationEvidence(session(), {
        latitude: -19.57,
        longitude: -65.75,
        accuracy: 50.001,
      }),
    ).toThrow();
  });
  it.each([
    { latitude: NaN },
    { longitude: Infinity },
    { accuracy: -1 },
    { authorization: 'x' },
    { latitude: '-19.57' },
    { positionTimestamp: Date.now() },
  ])('rejects invalid DTO including client freshness metadata %j', (patch) => {
    const dto = plainToInstance(AttendanceCombinedCheckInDto, {
      authorization: 'A'.repeat(43),
      latitude: -19.57,
      longitude: -65.75,
      accuracy: 10,
      ...patch,
    });
    expect(validateSync(dto, { whitelist: true, forbidNonWhitelisted: true })).not.toEqual([]);
  });
});
