import * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { saveAttendances, getAttendanceSession } from '@/api/attendances.service';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';
import type { IAttendance, IAttendanceSessionDetail } from '@/interfaces/attendances/attendance.interface';
import { useAttendances } from './useAttendances';

vi.mock('@/api/attendances.service', () => ({
  saveAttendances: vi.fn(),
  getAttendanceSession: vi.fn(),
  getAttendanceSessionsByEnrollment: vi.fn(),
  createAttendanceSession: vi.fn(),
}));
vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn((callback) => callback),
}));

function Harness() {
  const old = { idAttendance: 1, enrollment: { idEnrollment: 10 }, status: S.PRESENT } as IAttendance;
  const unchanged = { idAttendance: 2, enrollment: { idEnrollment: 11 }, status: S.ABSENT } as IAttendance;
  const slots: unknown[] = [[], { idAttendanceSession: 1, attendances: [old, unchanged] }, false, false, ''];
  let index = 0;

  vi.mocked(React.useState).mockImplementation(((initial: unknown) => {
    const slot = index++;

    if (!(slot in slots)) slots[slot] = initial;

    return [
      slots[slot],
      (value: unknown) => {
        slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
      },
    ];
  }) as unknown as typeof React.useState);

  return { slots, hook: useAttendances(20) };
}

beforeEach(() => vi.clearAllMocks());
describe('Confirmed bulk attendance saves', () => {
  it('updates the active session from confirmed records without a failing follow-up GET', async () => {
    const { slots, hook } = Harness();

    const confirmed = [
      { idAttendance: 1, enrollment: { idEnrollment: 10 }, status: S.EXCUSED, observation: 'Cita médica' },
    ] as IAttendance[];

    vi.mocked(saveAttendances).mockResolvedValueOnce(confirmed);
    vi.mocked(getAttendanceSession).mockRejectedValueOnce(new Error('Refresh failed'));
    await expect(
      hook.saveSessionAttendances(1, {
        attendances: [{ enrollmentId: 10, status: S.EXCUSED, observation: 'Cita médica' }],
      }),
    ).resolves.toEqual(confirmed);
    expect(getAttendanceSession).not.toHaveBeenCalled();
    expect((slots[1] as IAttendanceSessionDetail).attendances).toEqual([
      confirmed[0],
      expect.objectContaining({ enrollment: { idEnrollment: 11 }, status: S.ABSENT }),
    ]);
    expect(slots[3]).toBe(false);
  });
  it('propagates actual save errors without changing the original session', async () => {
    const { slots, hook } = Harness();
    const original = slots[1];

    vi.mocked(saveAttendances).mockRejectedValueOnce(new Error('Save failed'));
    await expect(hook.saveSessionAttendances(1, { attendances: [] })).rejects.toThrow('Save failed');
    expect(slots[1]).toBe(original);
    expect(slots[3]).toBe(false);
  });
});
