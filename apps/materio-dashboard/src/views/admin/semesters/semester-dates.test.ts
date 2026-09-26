import { describe, expect, it } from 'vitest';

import { semesterDateError, toLocalDateTime, toSemesterDate } from './semester-dates';

describe('Semester date editing', () => {
  it('does not shift existing instants or discard precision during an unrelated edit', () => {
    const original = '2026-07-01T00:00:00.123Z';

    expect(toSemesterDate(toLocalDateTime(original), original)).toBe(original);
  });

  it('converts changed local date-times to an explicit ISO instant', () => {
    const input = '2026-07-01T09:30:00';

    expect(toLocalDateTime(toSemesterDate(input))).toBe(input);
    expect(toSemesterDate(input)).toBe(new Date(input).toISOString());
  });

  it('rejects missing or reversed dates and accepts equal bounds like the backend', () => {
    expect(semesterDateError('', '2026-01-01')).not.toBe('');
    expect(semesterDateError('2026-06-01', '2026-01-01')).not.toBe('');
    expect(semesterDateError('2026-01-01', '2026-01-01')).toBe('');
    expect(semesterDateError('2026-01-01', '2026-06-01')).toBe('');
  });
});
