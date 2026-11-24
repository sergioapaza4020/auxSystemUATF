import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, Dialog, TextField } from '@mui/material';

import { AttendanceQrConfigDialog } from './AttendanceQrConfigDialog';
import { AttendanceQrPresentationDialog } from './AttendanceQrPresentationDialog';
import { elements, hookHarness, deferred } from '@/test-utils/hook-harness';
import type { IAttendanceSession } from '@/interfaces/attendances/attendance.interface';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  activate: vi.fn(),
  openNow: vi.fn(),
  close: vi.fn(),
  cancel: vi.fn(),
  refresh: vi.fn(),
  remove: vi.fn(),
  onClose: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks }));
vi.mock('@/api/attendances.service', () => ({
  configureAttendanceQr: mocks.configure,
  activateSession: mocks.activate,
  openSessionNow: mocks.openNow,
  closeSession: mocks.close,
  cancelSession: mocks.cancel,
}));

const fixture = (state: IAttendanceSession['state'] = 'DRAFT'): IAttendanceSession => ({
  idAttendanceSession: 7,
  date: '2026-11-12',
  mode: 'QR',
  state,
  startsAt: '2026-11-12T14:00:00Z',
  endsAt: '2026-11-12T15:00:00Z',
  presentCount: 0,
  excusedCount: 0,
  absentCount: 0,
  totalStudents: 20,
  percentage: 0,
});

const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-12T13:30:00Z'));
  vi.stubGlobal('window', new EventTarget());
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
  for (const fn of [
    mocks.configure,
    mocks.activate,
    mocks.openNow,
    mocks.close,
    mocks.cancel,
    mocks.refresh,
    mocks.remove,
  ])
    fn.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(state: IAttendanceSession['state'] = 'DRAFT', canUpdate = true) {
  const h = hookHarness(() =>
    AttendanceQrConfigDialog({
      session: fixture(state),
      course: 'Materia · Grupo 1',
      canUpdate,
      canGetQr: true,
      canDelete: true,
      onClose: mocks.onClose,
      onRefresh: mocks.refresh,
      onDelete: mocks.remove,
    }),
  );

  cleanups.push(h.unmount);

  return h;
}

const buttons = (tree: React.ReactNode) => elements<React.ComponentProps<typeof Button>>(tree, Button);
const button = (tree: React.ReactNode, label: string) => buttons(tree).find((b) => b.props.children === label)!.props;

const click = async (h: ReturnType<typeof setup>, label: string) => {
  const handler = button(h.render(), label).onClick;

  await handler?.({} as React.MouseEvent<HTMLButtonElement>);
};

describe('QR configuration and authorized lifecycle', () => {
  it('saves Bolivia wall time as explicit ISO without activating', async () => {
    const h = setup();

    await click(h, 'Guardar configuración');
    expect(mocks.configure).toHaveBeenCalledWith(7, {
      startsAt: '2026-11-12T14:00:00.000Z',
      endsAt: '2026-11-12T15:00:00.000Z',
    });
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('Configuración QR guardada correctamente.');
  });
  it('rejects invalid local times before calling backend', async () => {
    const h = setup();
    const fields = elements<React.ComponentProps<typeof TextField>>(h.render(), TextField);

    fields
      .find((f) => f.props.label === 'Duración de la asistencia (minutos)')!
      .props.onChange?.({ target: { value: '0' } } as React.ChangeEvent<HTMLInputElement>);
    await click(h, 'Guardar configuración');
    expect(mocks.configure).not.toHaveBeenCalled();
  });
  it.each(['Activar sesión', 'Abrir ahora', 'Cancelar sesión', 'Eliminar borrador'])(
    'confirms %s and prevents a duplicate mutation',
    async (label) => {
      const h = setup();

      await click(h, label);
      const pending = deferred<void>();

      const fn =
        label === 'Activar sesión'
          ? mocks.activate
          : label === 'Abrir ahora'
            ? mocks.openNow
            : label === 'Cancelar sesión'
              ? mocks.cancel
              : mocks.remove;

      fn.mockReturnValue(pending.promise);
      const first = click(h, 'Confirmar');
      const second = click(h, 'Confirmar');

      expect(fn).toHaveBeenCalledTimes(1);
      pending.resolve();
      await first;
      await second;
    },
  );
  it('closes an OPEN session only after confirmation', async () => {
    const h = setup('OPEN');

    await click(h, 'Cerrar sesión');
    expect(mocks.close).not.toHaveBeenCalled();
    await click(h, 'Confirmar');
    expect(mocks.close).toHaveBeenCalledWith(7);
  });
  it.each(['SCHEDULED', 'CLOSED', 'CANCELLED'] as const)(
    'freezes configuration and suppresses QR emission in %s',
    (state) => {
      const h = setup(state);
      const tree = h.render();

      expect(elements<React.ComponentProps<typeof TextField>>(tree, TextField).every((f) => f.props.disabled)).toBe(
        true,
      );
      expect(buttons(tree).some((b) => b.props.children === 'Mostrar QR')).toBe(false);
      expect(buttons(tree).some((b) => b.props.children === 'Activar sesión')).toBe(false);
    },
  );
  it('does not offer management actions without the update grant', () => {
    const h = setup('DRAFT', false);

    expect(buttons(h.render()).some((b) => b.props.children === 'Guardar configuración')).toBe(false);
  });
  it('opens presentation only after explicit action', async () => {
    const h = setup('OPEN');

    expect(elements(h.render(), AttendanceQrPresentationDialog)).toHaveLength(0);
    await click(h, 'Mostrar QR');
    expect(elements(h.render(), AttendanceQrPresentationDialog)).toHaveLength(1);
  });
  it('retains a successful mutation when refreshing the history fails', async () => {
    const h = setup();

    mocks.activate.mockResolvedValue({ mode: 'QR', state: 'SCHEDULED' });
    mocks.refresh.mockRejectedValue(new Error('offline'));
    await click(h, 'Activar sesión');
    await click(h, 'Confirmar');
    expect(mocks.success).toHaveBeenCalledWith('Sesión activada.');
    expect(mocks.warning).toHaveBeenCalled();
  });
  it('warns before discarding unsaved configuration', async () => {
    const h = setup();

    elements<React.ComponentProps<typeof TextField>>(h.render(), TextField)[0].props.onChange?.({
      target: { value: '2026-11-12T11:00' },
    } as React.ChangeEvent<HTMLInputElement>);
    await click(h, 'Cerrar configuración');
    expect(mocks.onClose).not.toHaveBeenCalled();
    expect(
      elements<React.ComponentProps<typeof Dialog>>(h.render(), Dialog).some(
        (d) => d.props.open && d.props['aria-labelledby'] === 'qr-confirm-title',
      ),
    ).toBe(true);
  });
});
