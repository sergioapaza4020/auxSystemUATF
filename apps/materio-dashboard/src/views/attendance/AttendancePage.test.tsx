import type * as React from 'react';

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Dialog, Tabs } from '@mui/material';

import AttendancePage from '@/app/dashboard/enrollments/[idEnrollment]/attendance/page';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';
import { AttendanceSheet } from './AttendanceSheet';
import { AttendanceHistory } from './AttendanceHistory';
import { AttendanceSessionToolbar } from './AttendanceSessionToolbar';
import { AttendanceSidebar } from './AttendanceSidebar';
import { AttendanceCreateDialog } from './AttendanceCreateDialog';
import { AttendanceQrConfigDialog } from './AttendanceQrConfigDialog';
import { AttendanceManualContingencyDialog } from './AttendanceManualContingencyDialog';
import { AttendanceAuditDialog } from './AttendanceAuditDialog';
import { AttendanceQrPresentationDialog } from './AttendanceQrPresentationDialog';
import { AttendanceGeolocationDialog } from './AttendanceGeolocationDialog';
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
  configureGeolocation: vi.fn(),
  activateSession: vi.fn(),
  openSessionNow: vi.fn(),
  closeSession: vi.fn(),
  cancelSession: vi.fn(),
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
  it.each(['MANUAL', 'GEOLOCATION', 'QR'] as const)(
    'creates a new %s session for an already used date',
    async (mode) => {
      const h = await open();
      const created = { ...data, idAttendanceSession: 2, mode };

      mocks.create.mockResolvedValue(created);
      mocks.load.mockResolvedValue(created);
      vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data: created, meta });
      find<React.ComponentProps<typeof AttendanceSessionToolbar>>(
        h.render(),
        AttendanceSessionToolbar,
      ).onCreateSession();
      find<React.ComponentProps<typeof AttendanceCreateDialog>>(h.render(), AttendanceCreateDialog).onCreate(mode);
      await vi.runAllTimersAsync();
      h.render();
      expect(mocks.create).toHaveBeenCalledTimes(1);
      expect(mocks.load).toHaveBeenLastCalledWith(2);
    },
  );

  it.each(['update', 'delete'] as const)('preserves the manual %s action', async (kind) => {
    const h = await open();
    const history = find<History>(h.render(), AttendanceHistory);

    if (kind === 'update') history.onEditDate?.(1, '2026-10-28');
    else history.onDeleteSession?.(1);

    const confirm = elements<React.ComponentProps<typeof Button>>(h.render(), Button).find(
      (item) => item.props.children === (kind === 'update' ? 'Guardar fecha' : 'Eliminar sesión'),
    );

    confirm?.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    await vi.runAllTimersAsync();
    if (kind === 'update') expect(mocks.updateDate).toHaveBeenCalledWith(1, '2026-10-28');
    else expect(mocks.remove).toHaveBeenCalledWith(1);
  });
  it.each(['GEOLOCATION', 'QR'] as const)('protects visible %s marks and mark-all', async (mode) => {
    const geoData = {
      ...data,
      mode,
      state: 'OPEN' as const,
      isComputable: false,
      attendances: [{ idAttendance: 5, status: S.PRESENT, registrationMethod: mode, enrollment: student }],
    };

    mocks.load.mockResolvedValue(geoData);
    vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data: geoData, meta });
    const h = await open();
    const sheet = find<Sheet>(h.render(), AttendanceSheet);

    expect(sheet.lockedStudentIds).toEqual([10]);
    expect(sheet.markAllDisabled).toBe(true);
    sheet.onMarkAllAbsent();
    sheet.onChangeAttendance(10, S.ABSENT);
    expect(find<Sheet>(h.render(), AttendanceSheet).hasChanges).toBe(false);
  });
  it.each(
    (['GEOLOCATION', 'QR'] as const).flatMap((mode) =>
      (['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const).map((state) => [mode, state] as const),
    ),
  )('%s %s keeps the sheet available with correct editing policy', async (mode, state) => {
    const geoData = { ...data, mode, state, isComputable: state === 'CLOSED' };

    mocks.load.mockResolvedValue(geoData);
    vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data: geoData, meta });
    const h = await open();
    const tree = h.render();
    const sheet = find<Sheet>(tree, AttendanceSheet);

    expect(sheet.readOnly).toBe(state !== 'OPEN' && state !== 'CLOSED');
    expect(sheet.pending).toBe(state !== 'CLOSED');
    expect(
      find<{ session: { state: string } }>(tree, mode === 'QR' ? AttendanceQrConfigDialog : AttendanceGeolocationDialog)
        .session.state,
    ).toBe(state);
  });
  it('selects GEO explicitly, creates a draft, and opens configuration', async () => {
    const h = await open();
    const geo = { ...data, idAttendanceSession: 2, mode: 'GEOLOCATION' as const, state: 'DRAFT' as const };

    mocks.create.mockResolvedValue(geo);
    mocks.load.mockResolvedValue(geo);
    vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data: geo, meta });
    find<React.ComponentProps<typeof AttendanceSessionToolbar>>(h.render(), AttendanceSessionToolbar).onCreateSession();
    find<React.ComponentProps<typeof AttendanceCreateDialog>>(h.render(), AttendanceCreateDialog).onCreate(
      'GEOLOCATION',
    );
    await vi.runAllTimersAsync();
    h.render();
    await vi.runAllTimersAsync();
    expect(mocks.create).toHaveBeenCalledWith(expect.any(String), 'GEOLOCATION');
    expect(
      find<React.ComponentProps<typeof AttendanceGeolocationDialog>>(h.render(), AttendanceGeolocationDialog).session
        .state,
    ).toBe('DRAFT');
  });
  it('creates a QR draft and opens configuration without activation', async () => {
    const h = await open();
    const qr = { ...data, idAttendanceSession: 2, mode: 'QR' as const, state: 'DRAFT' as const };

    mocks.create.mockResolvedValue(qr);
    mocks.load.mockResolvedValue(qr);
    vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data: qr, meta });
    find<React.ComponentProps<typeof AttendanceSessionToolbar>>(h.render(), AttendanceSessionToolbar).onCreateSession();
    const dialog = find<React.ComponentProps<typeof AttendanceCreateDialog>>(h.render(), AttendanceCreateDialog);

    dialog.onCreate('QR');
    dialog.onCreate('QR');
    await vi.runAllTimersAsync();
    h.render();
    await vi.runAllTimersAsync();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(expect.any(String), 'QR');
    expect(
      find<React.ComponentProps<typeof AttendanceQrConfigDialog>>(h.render(), AttendanceQrConfigDialog).session.state,
    ).toBe('DRAFT');
  });
  it('keeps manual creation using the original hook contract', async () => {
    const h = await open();

    mocks.create.mockResolvedValue(data);
    find<React.ComponentProps<typeof AttendanceSessionToolbar>>(h.render(), AttendanceSessionToolbar).onCreateSession();
    find<React.ComponentProps<typeof AttendanceCreateDialog>>(h.render(), AttendanceCreateDialog).onCreate('MANUAL');
    await vi.runAllTimersAsync();
    expect(mocks.create).toHaveBeenCalledWith(expect.any(String));
  });
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

describe('combined auxiliary page integration', () => {
  it.each(['DRAFT', 'SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const)(
    'scopes combined actions in %s',
    async (state) => {
      vi.stubGlobal('document', { visibilityState: 'visible' });
      vi.stubGlobal('window', {
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });

      const combined = {
        ...data,
        mode: 'GEOLOCATION_QR' as const,
        state,
        isComputable: state === 'CLOSED',
        pendingCount: state === 'OPEN' ? 30 : 0,
      };

      mocks.load.mockResolvedValue(combined);
      vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data: combined, meta });

      // The live OPEN refresher is an interval; advance only queued roster work here.
      const h = hookHarness(AttendancePage);

      cleanups.push(h.unmount);
      h.render();
      await vi.advanceTimersByTimeAsync(1);
      h.render();
      find<History>(h.render(), AttendanceHistory).onSelectSession(1);
      await vi.advanceTimersByTimeAsync(1);
      h.render();
      await vi.advanceTimersByTimeAsync(1);
      let tree = h.render();
      const sheet = find<Sheet>(tree, AttendanceSheet);

      expect(sheet.combined).toBe(true);
      expect(sheet.markAllDisabled).toBe(true);
      expect(!!sheet.onContingency).toBe(state === 'OPEN' || state === 'CLOSED');
      sheet.onMarkAllPresent();
      sheet.onChangeAttendance(10, S.PRESENT);
      await sheet.onSave();
      expect(mocks.save).not.toHaveBeenCalled();

      if (sheet.onContingency) {
        sheet.onContingency(student);
        tree = h.render();
        expect(elements(tree, AttendanceManualContingencyDialog)).toHaveLength(1);
      }

      const audit = elements<React.ComponentProps<typeof Button>>(tree, Button).find(
        (item) => item.props.children === 'Historial de cambios',
      );

      audit?.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
      expect(elements(h.render(), AttendanceAuditDialog)).toHaveLength(1);
      find<React.ComponentProps<typeof AttendanceSessionToolbar>>(h.render(), AttendanceSessionToolbar).onShowQr?.();
      if (state === 'OPEN') expect(elements(h.render(), AttendanceQrPresentationDialog)).toHaveLength(1);
    },
  );
});

it('creates exactly one combined draft on double click and opens the geographic configuration', async () => {
  const h = await open();
  const draft = { ...data, idAttendanceSession: 2, mode: 'GEOLOCATION_QR' as const, state: 'DRAFT' as const };

  mocks.create.mockResolvedValue(draft);
  mocks.load.mockResolvedValue(draft);
  vi.mocked(getAttendanceSessionPage).mockResolvedValue({ status: true, statusCode: 200, data: draft, meta });
  find<React.ComponentProps<typeof AttendanceSessionToolbar>>(h.render(), AttendanceSessionToolbar).onCreateSession();
  const dialog = find<React.ComponentProps<typeof AttendanceCreateDialog>>(h.render(), AttendanceCreateDialog);

  dialog.onCreate('GEOLOCATION_QR', '2026-10-20');
  dialog.onCreate('GEOLOCATION_QR', '2026-10-20');
  expect(find<React.ComponentProps<typeof AttendanceCreateDialog>>(h.render(), AttendanceCreateDialog).creating).toBe(
    true,
  );
  await vi.runAllTimersAsync();
  h.render();
  await vi.runAllTimersAsync();
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith('2026-10-20', 'GEOLOCATION_QR');
  expect(
    find<React.ComponentProps<typeof AttendanceGeolocationDialog>>(h.render(), AttendanceGeolocationDialog).session
      .state,
  ).toBe('DRAFT');
});
it('keeps a created combined draft when opening its detail fails, without repeating creation', async () => {
  const h = await open();

  mocks.create.mockResolvedValue({ ...data, idAttendanceSession: 2, mode: 'GEOLOCATION_QR', state: 'DRAFT' });
  mocks.load.mockRejectedValueOnce(new Error('offline'));
  find<React.ComponentProps<typeof AttendanceSessionToolbar>>(h.render(), AttendanceSessionToolbar).onCreateSession();
  find<React.ComponentProps<typeof AttendanceCreateDialog>>(h.render(), AttendanceCreateDialog).onCreate(
    'GEOLOCATION_QR',
  );
  await vi.runAllTimersAsync();
  h.render();
  expect(mocks.create).toHaveBeenCalledOnce();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('retómalo desde el historial'));
});
