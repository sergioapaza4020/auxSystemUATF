import { describe, expect, it } from 'vitest';

import {
  assistantLocationError,
  attendanceInstant,
  attendanceLocalTime,
  canDeleteAttendanceSession,
  canEditAttendance,
  getAttendanceGeoErrorMessage,
} from './attendance-geolocation';

describe('attendance GEO presentation policy', () => {
  it('converts Bolivia wall time to an absolute instant without browser timezone assumptions', () => {
    expect(attendanceInstant('2026-10-26T23:30')).toBe('2026-10-27T03:30:00.000Z');
    expect(attendanceLocalTime('2026-10-27T03:30:00Z')).toBe('2026-10-26T23:30');
  });
  it.each(['', '2026-02-30T12:30', '2026-10-26T25:00', 'invalid'])(
    'rejects ambiguous/invalid wall time %s',
    (value) => {
      expect(attendanceInstant(value)).toBeNull();
    },
  );
  it.each(['DRAFT', 'SCHEDULED', 'CANCELLED'] as const)('blocks manual marks in %s', (state) => {
    expect(canEditAttendance({ mode: 'GEOLOCATION', state })).toBe(false);
  });
  it.each(['OPEN', 'CLOSED'] as const)('allows manual exceptions in %s', (state) => {
    expect(canEditAttendance({ mode: 'GEOLOCATION', state })).toBe(true);
  });
  it('preserves manual behavior and only offers delete for a clean GEO draft', () => {
    expect(canEditAttendance({})).toBe(true);
    expect(canEditAttendance(null)).toBe(false);
    const counts = { presentCount: 0, excusedCount: 0, absentCount: 0 };

    expect(canDeleteAttendanceSession({ ...counts, mode: 'MANUAL' })).toBe(true);
    expect(canDeleteAttendanceSession({ ...counts, mode: 'GEOLOCATION', state: 'DRAFT' })).toBe(true);
    expect(canDeleteAttendanceSession({ ...counts, mode: 'GEOLOCATION', state: 'OPEN' })).toBe(false);
    expect(canDeleteAttendanceSession({ ...counts, presentCount: 1, mode: 'GEOLOCATION', state: 'DRAFT' })).toBe(false);
  });
  it('handles lifecycle message codes and optional code envelopes with a fallback', () => {
    expect(getAttendanceGeoErrorMessage(new Error('SESSION_DATE_CONFLICT'))).toContain('Ya existe');
    expect(
      getAttendanceGeoErrorMessage({
        isAxiosError: true,
        response: { data: { code: 'SESSION_WINDOW_EXPIRED', message: 'server' } },
      }),
    ).toContain('finalización');
    expect(getAttendanceGeoErrorMessage(new Error('Error del servidor'))).toBe('Error del servidor');
  });
  it.each([1, 2, 3])('location failure %s always offers manual map selection', (code) => {
    expect(assistantLocationError(code)).toContain('mapa');
  });
});
