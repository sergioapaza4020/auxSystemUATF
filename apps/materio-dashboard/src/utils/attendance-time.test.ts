import { describe, expect, it } from 'vitest';

import { attendanceDuration, attendanceDurationMinutes, attendanceEnd, attendanceToday } from './attendance-time';

describe('Attendance time in Bolivia', () => {
  it('uses the academic day around midnight independently of browser timezone', () => {
    expect(attendanceToday(new Date('2026-11-23T03:59:59Z'))).toBe('2026-11-22');
    expect(attendanceToday(new Date('2026-11-23T04:00:00Z'))).toBe('2026-11-23');
    expect(attendanceToday(new Date('2026-11-23T05:00:00+02:00'))).toBe('2026-11-22');
  });
  it.each(['0', '-1', '1.5', 'NaN', 'Infinity', 'abc', '', '9007199254740992'])(
    'rejects invalid duration %s',
    (value) => expect(attendanceDurationMinutes(value)).toBeNull(),
  );
  it('accepts one minute, no arbitrary maximum and crosses academic midnight', () => {
    expect(attendanceEnd('2026-03-08T02:30', '60')).toBe('2026-03-08T07:30:00.000Z');
    expect(attendanceEnd('2026-11-22T23:59', '1')).toBe('2026-11-23T04:00:00.000Z');
    expect(attendanceEnd('2026-11-22T23:59', '1441')).toBe('2026-11-24T04:00:00.000Z');
    expect(attendanceDuration('2026-11-23T03:59:00Z', '2026-11-23T04:00:00Z')).toBe('1');
  });
  it('rejects technical overflow without truncating or clamping', () => {
    expect(attendanceEnd('2026-11-22T10:00', String(Number.MAX_SAFE_INTEGER))).toBeNull();
    expect(attendanceEnd('9999-12-31T19:59', '1')).toBeNull();
  });
});
