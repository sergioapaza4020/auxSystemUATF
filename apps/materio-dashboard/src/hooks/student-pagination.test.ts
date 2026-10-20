import type * as React from 'react';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { getEnrollmentStudentsPage, getStudentGradeSummaryPage } from '@/api/enrollments.service';
import { getAttendanceSessionPage, type AttendanceSessionPage } from '@/api/attendances.service';
import type { PaginatedApiResponse } from '@/interfaces/apiResponse';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';
import { hookHarness, deferred } from '@/test-utils/hook-harness';
import { useEnrollmentStudentsPage } from './enrollments/useEnrollmentStudentsPage';
import { useAttendanceRoster } from './attendances/useAttendanceRoster';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('@/api/enrollments.service', () => ({
  getEnrollmentStudentsPage: vi.fn(),
  getStudentGradeSummaryPage: vi.fn(),
}));
vi.mock('@/api/attendances.service', () => ({ getAttendanceSessionPage: vi.fn() }));
const student = (id: number) => ({ idEnrollment: id, user: { name: 'Ana', lastname: 'Perez' } }) as IEnrollmentStudent;

const response = (page: number, search = ''): PaginatedApiResponse<AttendanceSessionPage> => ({
  status: true,
  statusCode: 200,
  meta: { page, limit: 25, total: search ? 1 : 60, totalPages: search ? 1 : 3 },
  data: {
    idAttendanceSession: 1,
    date: '2026-10-20',
    students: [student(page)],
    attendances: page === 1 ? [{ idAttendance: 1, enrollment: student(1), status: S.PRESENT }] : [],
    presentCount: 20,
    excusedCount: 10,
    absentCount: 30,
    totalStudents: 60,
    percentage: 50,
  },
});

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.mocked(getAttendanceSessionPage).mockImplementation(async (_id, query) => response(query.page, query.search));
});
afterEach(() => {
  cleanups.splice(0).forEach((clean) => clean());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mount<T>(useHook: () => T) {
  const h = hookHarness(useHook);

  cleanups.push(h.unmount);

  return h;
}

async function settle<T>(h: { render: () => T }) {
  h.render();
  await vi.runAllTimersAsync();

  return h.render();
}

describe('student roster and summary requests', () => {
  it('loads roster and summary together and resets page on search/size with debounce', async () => {
    vi.mocked(getStudentGradeSummaryPage).mockImplementation(async (_id, query) => ({
      status: true,
      statusCode: 200,
      meta: { page: query.page, limit: query.limit, total: 30, totalPages: 3 },
      data: { scheme: null, students: [], roster: [student(query.page)] },
    }));
    const h = mount(() => useEnrollmentStudentsPage(7, true));

    await settle(h);
    expect(getEnrollmentStudentsPage).not.toHaveBeenCalled();
    h.render().changeQuery({ page: 2 });
    await settle(h);
    expect(h.render().students[0].idEnrollment).toBe(2);
    h.render().changeQuery({ search: 'Ana' });
    h.render();
    expect(h.render().query.page).toBe(1);
    await vi.advanceTimersByTimeAsync(349);
    expect(getStudentGradeSummaryPage).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(getStudentGradeSummaryPage).toHaveBeenLastCalledWith(
      7,
      { page: 1, limit: 10, search: 'Ana' },
      expect.any(AbortSignal),
    );
    h.render().changeQuery({ limit: 25 });
    await settle(h);
    expect(h.render().meta.total).toBe(30);
  });
  it('ignores stale responses and clamps out-of-range pages', async () => {
    const slow = deferred<Awaited<ReturnType<typeof getEnrollmentStudentsPage>>>();

    vi.mocked(getEnrollmentStudentsPage)
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue({
        status: true,
        statusCode: 200,
        data: [student(2)],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
      });
    const h = mount(() => useEnrollmentStudentsPage(7, false));

    h.render();
    await vi.runAllTimersAsync();
    h.render().changeQuery({ page: 3 });
    await settle(h);
    await settle(h);
    slow.resolve({
      status: true,
      statusCode: 200,
      data: [student(99)],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    await vi.runAllTimersAsync();
    expect(h.render().students[0].idEnrollment).toBe(2);
    expect(h.render().query.page).toBe(1);
  });
});

describe('attendance drafts across pages', () => {
  it('keeps status and observation over refetch, sends dirty from multiple pages and discards globally', async () => {
    const h = mount(() => useAttendanceRoster(7, 1));

    await settle(h);
    await settle(h);
    h.render().edit(1, S.EXCUSED, ' Cita ');
    h.render().changeQuery({ page: 2 });
    await settle(h);
    expect(h.render().attendance[2]).toBe(S.ABSENT);
    h.render().edit(2, S.PRESENT);
    h.render().changeQuery({ page: 1 });
    await settle(h);
    expect(h.render().attendance[1]).toBe(S.EXCUSED);
    expect(h.render().observations[1]).toBe(' Cita ');
    expect(h.render().payload().attendances).toEqual([
      { enrollmentId: 1, status: S.EXCUSED, observation: 'Cita' },
      { enrollmentId: 2, status: S.PRESENT, observation: null },
    ]);
    expect(h.render().counts).toEqual({ present: 20, excused: 11, absent: 29 });
    h.render().discard();
    expect(h.render().hasChanges).toBe(false);
    expect(h.render().attendance[1]).toBe(S.PRESENT);
  });
  it('keeps global summary under search and applies mark-all to the course before exceptions', async () => {
    const h = mount(() => useAttendanceRoster(7, 1));

    await settle(h);
    await settle(h);
    h.render().changeQuery({ page: 2 });
    await settle(h);
    h.render().changeQuery({ search: 'Ana' });
    await settle(h);
    expect(h.render().query.page).toBe(1);
    expect(h.render().meta.total).toBe(1);
    expect(h.render().total).toBe(60);
    h.render().markAllStudents(S.PRESENT);
    expect(h.render().counts).toEqual({ present: 60, excused: 0, absent: 0 });
    h.render().edit(1, S.EXCUSED, 'Permiso');
    expect(h.render().payload()).toEqual({
      markAll: S.PRESENT,
      attendances: [{ enrollmentId: 1, status: S.EXCUSED, observation: 'Permiso' }],
    });
    h.render().edit(1, S.ABSENT);
    expect(h.render().observations[1]).toBeNull();
    h.render().confirmed();
    await settle(h);
    expect(h.render().hasChanges).toBe(false);
  });
  it('does not overwrite newer pages with an older response', async () => {
    const slow = deferred<ReturnType<typeof response>>();

    vi.mocked(getAttendanceSessionPage).mockReturnValueOnce(slow.promise);
    const h = mount(() => useAttendanceRoster(7, 1));

    h.render();
    await vi.runAllTimersAsync();
    h.render().changeQuery({ page: 2 });
    await settle(h);
    slow.resolve(response(1));
    await vi.runAllTimersAsync();
    expect(h.render().students[0].idEnrollment).toBe(2);
  });
});
