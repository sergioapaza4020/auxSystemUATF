import type * as React from 'react';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Dialog, Tabs } from '@mui/material';

import AttendancePage from '@/app/dashboard/enrollments/[idEnrollment]/attendance/page';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';
import { AttendanceSheet } from './AttendanceSheet';
import { AttendanceHistory } from './AttendanceHistory';
import { AttendanceSessionToolbar } from './AttendanceSessionToolbar';
import { AttendanceSidebar } from './AttendanceSidebar';
import { hookHarness, elements } from '@/test-utils/hook-harness';
import { getAttendanceSessionPage } from '@/api/attendances.service';
import { getEnrollmentStudentsPage } from '@/api/enrollments.service';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  reload: vi.fn(),
  remove: vi.fn(),
  updateDate: vi.fn(),
  create: vi.fn(),
  user: { roles: ['SUPERADMIN'], permissions: [] as string[] },
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ idEnrollment: '20' }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks }));
const enrollment = { idEnrollment: 20, course: { idCourse: 3, code: 'SIS', name: 'Materia' } };

vi.mock('@/hooks/enrollments/useEnrollment', () => ({ useEnrollment: () => ({ enrollment, loading: false }) }));
vi.mock('@/hooks/attendances/useAttendances', () => ({
  useAttendances: () => ({
    sessions: [],
    recentSessions: [],
    recentLoading: false,
    meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
    changeQuery: vi.fn(),
    findSessionByDate: vi.fn(),
    error: '',
    loading: false,
    saving: false,
    session: null,
    loadSession: mocks.load,
    saveSessionAttendances: mocks.save,
    loadSessions: mocks.reload,
    createSession: mocks.create,
  }),
}));
vi.mock('@/api/attendances.service', () => ({
  getAttendanceSessionPage: vi.fn(),
  deleteAttendanceSession: mocks.remove,
  updateAttendanceSession: mocks.updateDate,
}));
vi.mock('@/api/enrollments.service', () => ({ getEnrollmentStudentsPage: vi.fn() }));
vi.mock('@/api/assistant-grade-schemes.service', () => ({ getMyAssistantGradeScheme: vi.fn(async () => null) }));
const student = { idEnrollment: 10, user: { name: 'Ana', lastname: 'Perez' } } as IEnrollmentStudent;
const meta = { page: 1, limit: 25, total: 60, totalPages: 3 };

const data = {
  idAttendanceSession: 1,
  date: '2026-10-20',
  students: [student],
  attendances: [],
  presentCount: 20,
  excusedCount: 10,
  absentCount: 30,
  totalStudents: 60,
  percentage: 50,
};

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  mocks.user.roles = ['SUPERADMIN'];
  mocks.user.permissions = [];
  mocks.load.mockResolvedValue(data);
  mocks.save.mockResolvedValue([]);
  mocks.reload.mockResolvedValue(undefined);
  vi.mocked(getEnrollmentStudentsPage).mockResolvedValue({ status: true, statusCode: 200, data: [student], meta });
  vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data, meta });
});
afterEach(() => {
  cleanups.splice(0).forEach((clean) => clean());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const find = <P,>(tree: React.ReactNode, type: unknown) => elements<P>(tree, type)[0].props;

type Sheet = React.ComponentProps<typeof AttendanceSheet>;
type History = React.ComponentProps<typeof AttendanceHistory>;

async function open() {
  const h = hookHarness(AttendancePage);

  cleanups.push(h.unmount);
  let tree = h.render();

  await vi.runAllTimersAsync();
  tree = h.render();
  find<History>(tree, AttendanceHistory).onSelectSession(1);
  await vi.runAllTimersAsync();
  h.render();
  await vi.runAllTimersAsync();
  h.render();
  await vi.runAllTimersAsync();

  return h;
}

describe('attendance paginated page integration', () => {
  it('renders remote total, global sidebar and implicit ABSENT; tabs preserve edits', async () => {
    const h = await open();
    let tree = h.render();
    let sheet = find<Sheet>(tree, AttendanceSheet);

    expect(sheet.attendance[10]).toBe(S.ABSENT);
    expect(sheet.pagination?.meta.total).toBe(60);
    expect(sheet.totalStudents).toBe(60);
    sheet.onChangeAttendance(10, S.EXCUSED);
    tree = h.render();
    sheet = find<Sheet>(tree, AttendanceSheet);
    expect(sheet.hasChanges).toBe(true);
    find<React.ComponentProps<typeof Tabs>>(tree, Tabs).onChange?.({} as React.SyntheticEvent, 1);
    expect(find<Sheet>(h.render(), AttendanceSheet).attendance[10]).toBe(S.EXCUSED);
    expect(find<React.ComponentProps<typeof AttendanceSidebar>>(h.render(), AttendanceSidebar).total).toBe(60);
  });
  it('saves only dirty records once and keeps drafts on a failed bulk', async () => {
    const h = await open();

    find<Sheet>(h.render(), AttendanceSheet).onChangeAttendance(10, S.EXCUSED);
    find<Sheet>(h.render(), AttendanceSheet).onChangeObservation?.(10, 'Cita');
    mocks.save.mockRejectedValueOnce(new Error('Offline'));
    await find<Sheet>(h.render(), AttendanceSheet).onSave();
    expect(find<Sheet>(h.render(), AttendanceSheet).hasChanges).toBe(true);
    await find<Sheet>(h.render(), AttendanceSheet).onSave();
    expect(mocks.save).toHaveBeenLastCalledWith(1, {
      markAll: undefined,
      attendances: [{ enrollmentId: 10, status: S.EXCUSED, observation: 'Cita' }],
    });
    expect(find<Sheet>(h.render(), AttendanceSheet).hasChanges).toBe(false);
  });
  it('keeps mark-all global under search and cancel discards the whole intent', async () => {
    const h = await open();

    find<Sheet>(h.render(), AttendanceSheet).onSearchChange('Ana');
    h.render();
    await vi.runAllTimersAsync();
    find<Sheet>(h.render(), AttendanceSheet).onMarkAllPresent();
    expect(find<Sheet>(h.render(), AttendanceSheet).presentCount).toBe(60);
    await find<Sheet>(h.render(), AttendanceSheet).onSave();
    expect(mocks.save).toHaveBeenLastCalledWith(1, { markAll: S.PRESENT, attendances: [] });
    find<Sheet>(h.render(), AttendanceSheet).onMarkAllAbsent();
    find<Sheet>(h.render(), AttendanceSheet).onCancelChanges();
    expect(find<Sheet>(h.render(), AttendanceSheet).hasChanges).toBe(false);
  });
  it('guards editing and session opening when permissions are missing', async () => {
    const h = await open();

    mocks.user.roles = [];
    const tree = h.render();

    expect(find<Sheet>(tree, AttendanceSheet).readOnly).toBe(true);
    expect(find<React.ComponentProps<typeof AttendanceSessionToolbar>>(tree, AttendanceSessionToolbar).canCreate).toBe(
      false,
    );
    mocks.load.mockClear();
    find<History>(tree, AttendanceHistory).onSelectSession(2);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('requires discarding dirty marks before leaving', async () => {
    const h = await open();

    find<Sheet>(h.render(), AttendanceSheet).onChangeAttendance(10, S.PRESENT);

    const header = elements<{ onBack: () => void }>(
      h.render(),
      (await import('./AttendancePageHeader')).AttendancePageHeader,
    )[0];

    header.props.onBack();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(elements<React.ComponentProps<typeof Dialog>>(h.render(), Dialog).some((dialog) => dialog.props.open)).toBe(
      true,
    );

    const discard = elements<React.ComponentProps<typeof Button>>(h.render(), Button).find(
      (button) => button.props.children === 'Descartar cambios',
    );

    discard?.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(mocks.push).toHaveBeenCalledWith('/dashboard/enrollments/20');
  });
});
