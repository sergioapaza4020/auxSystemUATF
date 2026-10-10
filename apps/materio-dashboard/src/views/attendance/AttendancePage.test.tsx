import * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, Dialog, Tab, Tabs } from '@mui/material';

import AttendancePage from '@/app/dashboard/enrollments/[idEnrollment]/attendance/page';
import { AttendanceStatus as S } from '@/enums/attendanceStatus';
import { AttendancePageHeader } from './AttendancePageHeader';
import { AttendanceSessionToolbar } from './AttendanceSessionToolbar';
import { AttendanceSheet } from './AttendanceSheet';
import { AttendanceHistory } from './AttendanceHistory';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  load: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  reload: vi.fn(),
  remove: vi.fn(),
  updateDate: vi.fn(),
  user: { roles: ['SUPERADMIN'], permissions: [] as string[] },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: mocks.user }) }));

vi.mock('next/navigation', () => ({
  useParams: () => ({ idEnrollment: '20' }),
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('@/hooks/useSnackbar', () => ({
  useSnackbar: () => ({ success: mocks.success, error: mocks.error, warning: mocks.warning }),
}));
vi.mock('@/hooks/enrollments/useEnrollment', () => ({
  useEnrollment: () => ({
    enrollment: {
      idEnrollment: 20,
      course: { idCourse: 3, code: 'SIS-414', name: 'Tecnologías emergentes' },
      semester: { period: 'II', year: 2026 },
    },
    loading: false,
  }),
}));
vi.mock('@/hooks/attendances/useAttendances', () => ({
  useAttendances: () => ({
    sessions: [
      { idAttendanceSession: 1, date: '2026-09-28' },
      { idAttendanceSession: 2, date: '2026-09-29' },
    ],
    session: {
      idAttendanceSession: 1,
      date: '2026-09-28',
      attendances: [
        { enrollment: { idEnrollment: 10 }, status: 'PRESENT' },
        { enrollment: { idEnrollment: 11 }, status: 'EXCUSED' },
      ],
    },
    loading: false,
    saving: false,
    loadSession: mocks.load,
    createSession: mocks.create,
    saveSessionAttendances: mocks.save,
    loadSessions: mocks.reload,
  }),
}));
vi.mock('@/api/attendances.service', () => ({
  deleteAttendanceSession: mocks.remove,
  updateAttendanceSession: mocks.updateDate,
}));
vi.mock('@/api/enrollments.service', () => ({ getEnrollmentStudents: vi.fn() }));
vi.mock('@/api/assistant-grade-schemes.service', () => ({ getMyAssistantGradeScheme: vi.fn() }));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof React>('react');

  return {
    ...actual,
    useState: vi.fn(actual.useState),
    useMemo: vi.fn(actual.useMemo),
    useEffect: vi.fn(actual.useEffect),
  };
});
const actual = await vi.importActual<typeof React>('react');

function find(tree: React.ReactNode, type: unknown): React.ReactElement<Record<string, unknown>>[] {
  const result: React.ReactElement<Record<string, unknown>>[] = [];

  React.Children.forEach(tree, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    if (child.type === type) result.push(child);
    result.push(...find(child.props.children as React.ReactNode, type));
  });

  return result;
}

function harness() {
  const students = [10, 11, 12].map((idEnrollment) => ({
    idEnrollment,
    user: { name: `Alumno ${idEnrollment}`, lastname: 'Pérez', ci: String(idEnrollment), ru: String(idEnrollment) },
  }));

  const original = { 10: S.ABSENT, 11: S.ABSENT, 12: S.ABSENT };

  const slots: unknown[] = [
    students,
    false,
    '2026-10-10',
    1,
    { ...original },
    { ...original },
    '',
    null,
    false,
    { weight: 0.5, loading: false, error: false },
  ];

  const effects: React.EffectCallback[] = [];

  return {
    slots,
    effects,
    render() {
      let index = 0;

      effects.length = 0;
      vi.mocked(React.useState).mockImplementation(((initial?: unknown) => {
        const slot = index++;

        if (!(slot in slots)) slots[slot] = typeof initial === 'function' ? initial() : initial;

        return [
          slots[slot],
          (value: unknown) => {
            slots[slot] = typeof value === 'function' ? value(slots[slot]) : value;
          },
        ];
      }) as unknown as typeof React.useState);
      vi.mocked(React.useMemo).mockImplementation((factory) => factory());
      vi.mocked(React.useEffect).mockImplementation((effect) => {
        effects.push(effect);
      });

      try {
        return AttendancePage();
      } finally {
        vi.mocked(React.useState).mockImplementation(actual.useState);
        vi.mocked(React.useMemo).mockImplementation(actual.useMemo);
        vi.mocked(React.useEffect).mockImplementation(actual.useEffect);
      }
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.roles = ['SUPERADMIN'];
  mocks.user.permissions = [];
  mocks.load.mockResolvedValue({ idAttendanceSession: 2, date: '2026-09-29', attendances: [] });
  mocks.create.mockResolvedValue({ idAttendanceSession: 3, date: '2026-10-10' });
  mocks.save.mockImplementation(
    (_id: number, data: { attendances: { enrollmentId: number; status: S; observation: string | null }[] }) =>
      Promise.resolve(
        data.attendances.map((record) => ({
          idAttendance: record.enrollmentId,
          enrollment: { idEnrollment: record.enrollmentId },
          status: record.status,
          observation: record.observation,
        })),
      ),
  );
  mocks.reload.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.updateDate.mockResolvedValue({});
});

describe('Attendance UI navigation and batch editing', () => {
  it('switches views without losing the current local draft or making requests', () => {
    const h = harness();

    h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    (find(h.render(), Tabs)[0].props.onChange as (event: null, value: number) => void)(null, 1);
    expect(h.slots[10]).toBe(1);
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('disables editing and guards opening when permission is missing', () => {
    mocks.user.roles = [];
    const tree = harness().render();

    expect(find(tree, AttendanceSheet)[0].props.readOnly).toBe(true);
    expect(find(tree, AttendanceSessionToolbar)[0].props.canCreate).toBe(false);
    expect(find(tree, AttendanceHistory)[0].props.onDeleteSession).toBeUndefined();
    (find(tree, AttendanceHistory)[0].props.onSelectSession as (id: number) => void)(2);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('initializes unmarked students as absent while preserving explicit permission', () => {
    const h = harness();

    h.render();
    h.effects[2]();
    const sheet = find(h.render(), AttendanceSheet)[0];

    expect(sheet.props.attendance).toEqual({ 10: S.PRESENT, 11: S.EXCUSED, 12: S.ABSENT });
    expect(sheet.props.hasChanges).toBe(false);
  });
  it('edits locally, counts modified students, and saves once as a batch', async () => {
    const h = harness();
    let sheet = find(h.render(), AttendanceSheet)[0];

    (sheet.props.onChangeAttendance as (id: number, status: S) => void)(10, S.EXCUSED);
    sheet = find(h.render(), AttendanceSheet)[0];
    expect(sheet.props.modifiedStudentIds).toEqual([10]);
    expect(sheet.props.excusedCount).toBe(1);
    expect(mocks.save).not.toHaveBeenCalled();
    await (sheet.props.onSave as () => Promise<void>)();
    expect(mocks.save).toHaveBeenCalledOnce();
    expect(mocks.save).toHaveBeenCalledWith(1, {
      attendances: [
        { enrollmentId: 10, status: S.EXCUSED, observation: null },
        { enrollmentId: 11, status: S.ABSENT, observation: null },
        { enrollmentId: 12, status: S.ABSENT, observation: null },
      ],
    });
    expect(mocks.reload).toHaveBeenCalledOnce();
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.warning).not.toHaveBeenCalled();
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
  });
  it('tracks observations in the same draft, restores them and retains them after errors', async () => {
    const h = harness();

    h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    h.slots[5] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };

    const change = (value: string) =>
      (find(h.render(), AttendanceSheet)[0].props.onChangeObservation as (id: number, value: string) => void)(
        10,
        value,
      );

    change('Cita médica');
    expect(find(h.render(), AttendanceSheet)[0].props.modifiedStudentIds).toEqual([10]);
    expect(mocks.save).not.toHaveBeenCalled();
    change('');
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
    change('Cita médica');
    mocks.save.mockRejectedValueOnce(new Error('Offline'));
    await (find(h.render(), AttendanceSheet)[0].props.onSave as () => Promise<void>)();
    expect(find(h.render(), AttendanceSheet)[0].props.observations).toEqual({ 10: 'Cita médica' });
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
    expect(mocks.save.mock.calls[0][1].attendances[0].observation).toBe('Cita médica');
    (find(h.render(), AttendanceSheet)[0].props.onCancelChanges as () => void)();
    expect(find(h.render(), AttendanceSheet)[0].props.observations).toEqual({});
  });
  it.each([S.PRESENT, S.ABSENT])('clears dirty after %s to permission and back without observations', (original) => {
    const h = harness();

    h.slots[4] = { 10: original, 11: S.ABSENT, 12: S.ABSENT };
    h.slots[5] = { 10: original, 11: S.ABSENT, 12: S.ABSENT };

    const change = (status: S) =>
      (find(h.render(), AttendanceSheet)[0].props.onChangeAttendance as (id: number, status: S) => void)(10, status);

    change(S.EXCUSED);
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
    change(original);
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
  });
  it.each([S.PRESENT, S.ABSENT])(
    'clears observations when leaving permission for %s and saves null',
    async (status) => {
      const h = harness();

      h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
      h.slots[5] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
      h.slots[11] = { 10: 'A' };
      h.slots[12] = { 10: 'A' };
      (find(h.render(), AttendanceSheet)[0].props.onChangeAttendance as (id: number, status: S) => void)(10, status);
      expect(find(h.render(), AttendanceSheet)[0].props.observations).toEqual({ 10: null });
      await (find(h.render(), AttendanceSheet)[0].props.onSave as () => Promise<void>)();
      expect(mocks.save.mock.calls[0][1].attendances[0]).toEqual({ enrollmentId: 10, status, observation: null });
      expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
    },
  );
  it('compares normalized observations, reverts changes, and accepts confirmed backend data', async () => {
    const h = harness();

    h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    h.slots[5] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    h.slots[11] = { 10: '' };
    h.slots[12] = { 10: null };
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);

    const change = (value: string) =>
      (find(h.render(), AttendanceSheet)[0].props.onChangeObservation as (id: number, value: string) => void)(
        10,
        value,
      );

    h.slots[11] = { 10: 'A' };
    h.slots[12] = { 10: 'A' };
    change('B');
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
    change('A');
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
    change(' B ');
    await (find(h.render(), AttendanceSheet)[0].props.onSave as () => Promise<void>)();
    expect(find(h.render(), AttendanceSheet)[0].props.observations).toEqual({ 10: 'B', 11: null, 12: null });
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
  });
  it('clears permission observations with bulk actions and restores them on cancel', () => {
    const h = harness();

    h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    h.slots[5] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    h.slots[11] = { 10: 'A' };
    h.slots[12] = { 10: 'A' };
    (find(h.render(), AttendanceSheet)[0].props.onMarkAllPresent as () => void)();
    expect(find(h.render(), AttendanceSheet)[0].props.observations).toEqual({ 10: null, 11: null, 12: null });
    (find(h.render(), AttendanceSheet)[0].props.onCancelChanges as () => void)();
    expect(find(h.render(), AttendanceSheet)[0].props.observations).toEqual({ 10: 'A' });
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
  });
  it('applies bulk actions to the whole roster and restores the snapshot on cancel', () => {
    const h = harness();

    h.slots[6] = 'Alumno 10';
    const sheet = find(h.render(), AttendanceSheet)[0];

    (sheet.props.onMarkAllPresent as () => void)();
    expect(find(h.render(), AttendanceSheet)[0].props.modifiedStudentIds).toEqual([10, 11, 12]);
    (sheet.props.onCancelChanges as () => void)();
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
  });
  it.each(['open', 'create', 'back'])(
    'protects %s with the MUI dialog and preserves edits when cancelled',
    (action) => {
      const h = harness();

      h.slots[4] = { 10: S.PRESENT, 11: S.ABSENT, 12: S.ABSENT };
      const tree = h.render();

      if (action === 'open') (find(tree, AttendanceHistory)[0].props.onSelectSession as (id: number) => void)(2);
      if (action === 'create') (find(tree, AttendanceSessionToolbar)[0].props.onCreateSession as () => void)();
      if (action === 'back') (find(tree, AttendancePageHeader)[0].props.onBack as () => void)();
      const dialog = find(h.render(), Dialog)[0];

      expect(dialog.props.open).toBe(true);
      expect(mocks.load).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
      const buttons = find(dialog, Button);

      (buttons[0].props.onClick as () => void)();
      expect(find(h.render(), Dialog)[0].props.open).toBe(false);
      expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
    },
  );
  it('opens the requested session only after discarding and synchronizes the date', async () => {
    const h = harness();

    h.slots[4] = { 10: S.PRESENT, 11: S.ABSENT, 12: S.ABSENT };
    (find(h.render(), AttendanceHistory)[0].props.onSelectSession as (id: number) => void)(2);
    const buttons = find(find(h.render(), Dialog)[0], Button);

    (buttons[1].props.onClick as () => void)();
    await vi.waitFor(() => expect(h.slots[3]).toBe(2));
    expect(mocks.load).toHaveBeenCalledWith(2);
    expect(find(h.render(), AttendanceSessionToolbar)[0].props.selectedDate).toBe('2026-09-29');
  });
  it.each(['create', 'back'])('continues %s only after explicit discard', async (action) => {
    const h = harness();

    h.slots[4] = { 10: S.PRESENT, 11: S.ABSENT, 12: S.ABSENT };
    const tree = h.render();

    if (action === 'create') (find(tree, AttendanceSessionToolbar)[0].props.onCreateSession as () => void)();
    else (find(tree, AttendancePageHeader)[0].props.onBack as () => void)();
    (find(find(h.render(), Dialog)[0], Button)[1].props.onClick as () => void)();
    await vi.waitFor(() => {
      if (action === 'create') expect(mocks.create).toHaveBeenCalledWith('2026-10-10');
      else expect(mocks.push).toHaveBeenCalledWith('/dashboard/enrollments/20');
    });
  });
  it('preserves the local draft if batch saving fails', async () => {
    const h = harness();

    mocks.save.mockRejectedValue(new Error('Offline'));
    h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    await (find(h.render(), AttendanceSheet)[0].props.onSave as () => Promise<void>)();
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalled();
  });
  it('confirms session deletion and protects observations before using the existing service', async () => {
    const h = harness();

    h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    h.slots[5] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };

    (find(h.render(), AttendanceSheet)[0].props.onChangeObservation as (id: number, value: string) => void)(
      10,
      'Cita médica',
    );
    (find(h.render(), AttendanceHistory)[0].props.onDeleteSession as (id: number) => void)(1);
    (find(find(h.render(), Dialog)[1], Button)[1].props.onClick as () => void)();
    expect(find(h.render(), Dialog)[0].props.open).toBe(true);
    expect(mocks.remove).not.toHaveBeenCalled();
    (find(find(h.render(), Dialog)[0], Button)[1].props.onClick as () => void)();
    await vi.waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(1));
    await vi.waitFor(() => expect(h.slots[3]).toBeNull());
    expect(h.slots[11]).toEqual({});
  });
  it('keeps the current session and local edits if opening another session fails', async () => {
    const h = harness();

    mocks.load.mockRejectedValue(new Error('Offline'));
    h.slots[4] = { 10: S.PRESENT, 11: S.ABSENT, 12: S.ABSENT };
    (find(h.render(), AttendanceHistory)[0].props.onSelectSession as (id: number) => void)(2);
    (find(find(h.render(), Dialog)[0], Button)[1].props.onClick as () => void)();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(h.slots[3]).toBe(1);
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
  });
});

describe('Save feedback and available tabs', () => {
  it('keeps confirmed attendance clean and emits one warning if history refresh fails', async () => {
    const h = harness();

    h.slots[4] = { 10: S.EXCUSED, 11: S.PRESENT, 12: S.ABSENT };
    h.slots[11] = { 10: 'Cita médica' };
    mocks.reload.mockRejectedValueOnce(new Error('Historial desconectado'));
    await (find(h.render(), AttendanceSheet)[0].props.onSave as () => Promise<void>)();
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(false);
    expect(find(h.render(), AttendanceSheet)[0].props.observations).toEqual({ 10: 'Cita médica', 11: null, 12: null });
    expect(mocks.warning).toHaveBeenCalledExactlyOnceWith(
      'Asistencia guardada. No se pudo actualizar el historial: Historial desconectado',
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it('reports the actual save error without clearing dirty or refreshing history', async () => {
    const h = harness();

    h.slots[4] = { 10: S.EXCUSED, 11: S.ABSENT, 12: S.ABSENT };
    mocks.save.mockRejectedValueOnce(new Error('Sin autorización'));
    await (find(h.render(), AttendanceSheet)[0].props.onSave as () => Promise<void>)();
    expect(find(h.render(), AttendanceSheet)[0].props.hasChanges).toBe(true);
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith('No se pudo guardar la asistencia: Sin autorización');
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.warning).not.toHaveBeenCalled();
  });
  it('shows only attendance and history, with attendance initially selected', () => {
    const tree = harness().render();

    expect(find(tree, Tabs)[0].props.value).toBe(0);
    expect(find(tree, Tab).map((item) => item.props.label)).toEqual(['Asistencia', 'Historial de sesiones']);
    expect(JSON.stringify(tree)).not.toContain('attendance-panel-2');
  });
});
