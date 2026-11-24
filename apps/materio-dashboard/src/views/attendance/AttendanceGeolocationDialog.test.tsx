import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, Button, Dialog, TextField } from '@mui/material';

import { AttendanceGeolocationDialog, AttendanceMap } from './AttendanceGeolocationDialog';
import type { AttendanceGeolocationMapProps } from './AttendanceGeolocationMap';
import type { IAttendanceSession } from '@/interfaces/attendances/attendance.interface';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { assistantLocationError } from '@/utils/attendance-geolocation';

const mocks = vi.hoisted(() => ({
  configure: vi.fn(),
  activate: vi.fn(),
  openNow: vi.fn(),
  close: vi.fn(),
  cancel: vi.fn(),
  refresh: vi.fn(),
  onClose: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  locate: vi.fn(),
}));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub() {
      return null;
    },
}));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks }));
vi.mock('@/api/attendances.service', () => ({
  configureGeolocation: mocks.configure,
  activateSession: mocks.activate,
  openSessionNow: mocks.openNow,
  closeSession: mocks.close,
  cancelSession: mocks.cancel,
}));

const session = (): IAttendanceSession => ({
  idAttendanceSession: 7,
  date: '2026-10-26',
  mode: 'GEOLOCATION',
  state: 'DRAFT',
  isComputable: false,
  latitude: -19,
  longitude: -65,
  radiusMeters: 50,
  maximumAcceptedAccuracy: 50,
  startsAt: '2026-10-26T14:00:00Z',
  endsAt: '2026-10-26T15:00:00Z',
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
  vi.setSystemTime(new Date('2026-10-26T13:30:00Z'));
  for (const action of [mocks.configure, mocks.activate, mocks.openNow, mocks.close, mocks.cancel, mocks.refresh])
    action.mockResolvedValue(undefined);
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: mocks.locate } });
});
afterEach(() => {
  cleanups.splice(0).forEach((clean) => clean());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function setup(initial: IAttendanceSession = session(), canUpdate = true) {
  let current = initial;

  const h = hookHarness(() =>
    AttendanceGeolocationDialog({ session: current, canUpdate, onClose: mocks.onClose, onRefresh: mocks.refresh }),
  );

  cleanups.push(h.unmount);

  return {
    ...h,
    update: (next: IAttendanceSession) => {
      current = next;
    },
  };
}

function button(tree: React.ReactNode, label: string) {
  const found = elements<React.ComponentProps<typeof Button>>(tree, Button).find(
    (item) => item.props.children === label,
  );

  if (!found) throw new Error(`Missing button ${label}`);

  return found.props;
}

const click = async (props: React.ComponentProps<typeof Button>) => {
  if (!props.disabled) await props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
};

describe('assistant GEO configuration', () => {
  it('uses the saved map point and duration without editable coordinate or end fields', () => {
    const h = setup();
    const tree = h.render();
    const fields = elements<React.ComponentProps<typeof TextField>>(tree, TextField);

    expect(fields.some((item) => /Latitud|Longitud|Fin/.test(String(item.props.label)))).toBe(false);
    expect(fields.find((item) => item.props.label === 'Duración de la asistencia (minutos)')?.props.value).toBe('60');
    const map = elements<AttendanceGeolocationMapProps>(tree, AttendanceMap)[0].props;

    expect(map).toMatchObject({ latitude: -19, longitude: -65, radiusMeters: 50, disabled: false });
    map.onLocationChange(-18, -64);
    expect(elements<AttendanceGeolocationMapProps>(h.render(), AttendanceMap)[0].props).toMatchObject({
      latitude: -18,
      longitude: -64,
    });
  });

  it('uses complete local form, converts Bolivia times, and saves without activating', async () => {
    const h = setup();
    let tree = h.render();
    const map = elements<AttendanceGeolocationMapProps>(tree, AttendanceMap)[0].props;

    expect(map.disabled).toBe(false);
    map.onLocationChange(-19.572312345, -65.755123456);
    tree = h.render();
    expect(button(tree, 'Activar sesión').disabled).toBe(true);
    await click(button(tree, 'Guardar configuración'));
    expect(mocks.configure).toHaveBeenCalledWith(7, {
      latitude: -19.572312,
      longitude: -65.755123,
      radiusMeters: 50,
      maximumAcceptedAccuracy: 50,
      startsAt: '2026-10-26T14:00:00.000Z',
      endsAt: '2026-10-26T15:00:00.000Z',
    });
    expect(mocks.activate).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it.each(['SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const)('locks configuration in %s', (state) => {
    const h = setup({ ...session(), state });
    const tree = h.render();

    expect(elements<AttendanceGeolocationMapProps>(tree, AttendanceMap)[0].props.disabled).toBe(true);
    expect(
      elements<React.ComponentProps<typeof TextField>>(tree, TextField).every((field) => field.props.disabled),
    ).toBe(true);
    expect(
      elements<React.ComponentProps<typeof Button>>(tree, Button).some((item) => item.props.children === 'Abrir ahora'),
    ).toBe(false);
    expect(
      elements<React.ComponentProps<typeof Button>>(tree, Button).some(
        (item) => item.props.children === 'Cancelar sesión',
      ),
    ).toBe(state === 'SCHEDULED');
  });
  it('keeps the requested opening duration when the server retains an omitted draft schedule', async () => {
    const h = setup();

    const field = (label: string) =>
      elements<React.ComponentProps<typeof TextField>>(h.render(), TextField).find(
        (item) => item.props.label === label,
      )!.props;

    field('Fecha y hora de inicio').onChange?.({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
    field('Duración de la asistencia (minutos)').onChange?.({
      target: { value: '1' },
    } as React.ChangeEvent<HTMLInputElement>);
    mocks.configure.mockResolvedValueOnce(session());
    await click(button(h.render(), 'Guardar configuración'));
    expect(mocks.configure).toHaveBeenLastCalledWith(7, {
      latitude: -19,
      longitude: -65,
      radiusMeters: 50,
      maximumAcceptedAccuracy: 50,
    });
    expect(field('Duración de la asistencia (minutos)').value).toBe('1');
    expect(field('Fecha y hora de inicio').value).toBe('');
    expect(button(h.render(), 'Abrir ahora').disabled).toBe(false);
  });
  it('reads a historical short window without applying new-draft validation errors', () => {
    const h = setup({ ...session(), state: 'CLOSED', endsAt: '2026-10-26T14:00:30Z' });

    const field = elements<React.ComponentProps<typeof TextField>>(h.render(), TextField).find(
      (item) => item.props.label === 'Duración de la asistencia (minutos)',
    )!.props;

    expect(field.value).toBe('0.5');
    expect(field.disabled).toBe(true);
    expect(field.error).toBe(false);
  });
  it('requires update permission even for a draft', () => {
    const tree = setup(session(), false).render();

    expect(elements<AttendanceGeolocationMapProps>(tree, AttendanceMap)[0].props.disabled).toBe(true);
    expect(
      elements<React.ComponentProps<typeof Button>>(tree, Button).some(
        (item) => item.props.children === 'Guardar configuración',
      ),
    ).toBe(false);
  });
  it('uses one explicit high accuracy GPS request without changing student accuracy limit', () => {
    const h = setup();

    void click(button(h.render(), 'Usar mi ubicación actual'));
    expect(mocks.locate).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
    const accept = mocks.locate.mock.calls[0][0] as PositionCallback;

    accept({ coords: { latitude: -18, longitude: -64, accuracy: 18 } } as GeolocationPosition);
    const tree = h.render();

    expect(elements<AttendanceGeolocationMapProps>(tree, AttendanceMap)[0].props.latitude).toBe(-18);
    expect(
      elements<React.ComponentProps<typeof TextField>>(tree, TextField).find(
        (field) => field.props.label === 'Precisión máxima del GPS (metros)',
      )?.props.value,
    ).toBe('50');
  });
  it.each([1, 2, 3])('GPS failure %s leaves the map editable', (code) => {
    const h = setup();

    void click(button(h.render(), 'Usar mi ubicación actual'));
    (mocks.locate.mock.calls[0][1] as PositionErrorCallback)({ code } as GeolocationPositionError);
    expect(elements<AttendanceGeolocationMapProps>(h.render(), AttendanceMap)[0].props.disabled).toBe(false);
    expect(button(h.render(), 'Usar mi ubicación actual').disabled).toBe(false);
    expect(
      elements<React.ComponentProps<typeof Alert>>(h.render(), Alert).some(
        (item) => item.props.children === assistantLocationError(code),
      ),
    ).toBe(true);
  });
  it('invalid window cannot be saved or activated', async () => {
    const h = setup();
    const tree = h.render();

    const field = elements<React.ComponentProps<typeof TextField>>(tree, TextField).find(
      (item) => item.props.label === 'Duración de la asistencia (minutos)',
    );

    field?.props.onChange?.({ target: { value: '0' } } as React.ChangeEvent<HTMLInputElement>);
    await click(button(h.render(), 'Guardar configuración'));
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(button(h.render(), 'Activar sesión').disabled).toBe(true);
  });
  it.each([
    ['activate', 'Activar sesión', 'DRAFT', 'SCHEDULED'],
    ['openNow', 'Abrir ahora', 'DRAFT', 'OPEN'],
    ['close', 'Cerrar sesión', 'OPEN', 'CLOSED'],
    ['cancel', 'Cancelar sesión', 'SCHEDULED', 'CANCELLED'],
    ['cancel', 'Cancelar sesión', 'DRAFT', 'CANCELLED'],
  ] as const)(
    '%s requires confirmation, refetches, and reflects the server state',
    async (method, label, origin, target) => {
      const h = setup({ ...session(), state: origin });

      await click(button(h.render(), label));
      expect(mocks[method]).not.toHaveBeenCalled();

      const confirmation = elements<React.ComponentProps<typeof Dialog>>(h.render(), Dialog)
        .filter((item) => item.props.open)
        .at(-1);

      if (!confirmation) throw new Error('Missing confirmation');
      await click(button(confirmation.props.children, label));
      if (method === 'openNow') expect(mocks[method]).toHaveBeenCalledWith(7, 60);
      else expect(mocks[method]).toHaveBeenCalledWith(7);
      expect(mocks.refresh).toHaveBeenCalledTimes(1);
      h.update({ ...session(), state: target });
      h.render();
      expect(elements<AttendanceGeolocationMapProps>(h.render(), AttendanceMap)[0].props.disabled).toBe(true);
    },
  );
  it('keeps dirty edits on a failed save and confirms discarding before leaving', async () => {
    const h = setup();

    elements<AttendanceGeolocationMapProps>(h.render(), AttendanceMap)[0].props.onLocationChange(-18, -64);
    mocks.configure.mockRejectedValueOnce(new Error('SESSION_DATE_CONFLICT'));
    await click(button(h.render(), 'Guardar configuración'));
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Ya existe'));
    await click(button(h.render(), 'Volver a la planilla'));
    expect(mocks.onClose).not.toHaveBeenCalled();
    await click(button(h.render(), 'Descartar cambios'));
    expect(mocks.onClose).toHaveBeenCalledOnce();
  });
});

describe('combined progressive configuration', () => {
  it('saves an incomplete draft without nulls or activation', async () => {
    const h = setup({
      ...session(),
      mode: 'GEOLOCATION_QR',
      latitude: null,
      longitude: null,
      startsAt: null,
      endsAt: null,
    });

    const tree = h.render();

    expect(button(tree, 'Activar sesión').disabled).toBe(true);
    await click(button(tree, 'Guardar configuración'));
    expect(mocks.configure).toHaveBeenCalledWith(7, { radiusMeters: 50, maximumAcceptedAccuracy: 50 });
    expect(mocks.activate).not.toHaveBeenCalled();
  });
  it('permits open-now with saved geofence and end, leaving authoritative start to server', async () => {
    const h = setup({ ...session(), mode: 'GEOLOCATION_QR', startsAt: null });

    expect(button(h.render(), 'Activar sesión').disabled).toBe(true);

    const durationField = elements<React.ComponentProps<typeof TextField>>(h.render(), TextField).find(
      (item) => item.props.label === 'Duración de la asistencia (minutos)',
    );

    durationField?.props.onChange?.({ target: { value: '1' } } as React.ChangeEvent<HTMLInputElement>);
    await click(button(h.render(), 'Guardar configuración'));
    expect(button(h.render(), 'Abrir ahora').disabled).toBe(false);
    await click(button(h.render(), 'Abrir ahora'));

    const confirmation = elements<React.ComponentProps<typeof Dialog>>(h.render(), Dialog).find(
      (item) => item.props['aria-labelledby'] === 'attendance-geo-confirm-title',
    );

    await click(button(confirmation?.props.children, 'Abrir ahora'));
    expect(mocks.openNow).toHaveBeenCalledWith(7, 1);
  });
  it.each(['SCHEDULED', 'OPEN', 'CLOSED', 'CANCELLED'] as const)('locks combined configuration in %s', (state) => {
    const h = setup({ ...session(), mode: 'GEOLOCATION_QR', state });

    expect(elements<AttendanceGeolocationMapProps>(h.render(), AttendanceMap)[0].props.disabled).toBe(true);
    expect(
      elements<React.ComponentProps<typeof TextField>>(h.render(), TextField).every((item) => item.props.disabled),
    ).toBe(true);
  });
});
