import type { ComponentProps } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '@mui/material';

import { StudentQrAttendance } from './StudentQrAttendance';
import { qrContext, qrMark, qrToken } from '@/test-utils/qr-fixtures';
import { elements } from '@/test-utils/hook-harness';

const mock = vi.hoisted(() => ({ hook: vi.fn(), confirm: vi.fn(), read: vi.fn() }));

vi.mock('@/hooks/attendances/useStudentQrAttendance', () => ({ useStudentQrAttendance: mock.hook }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.hook.mockReturnValue({
    phase: 'READY',
    context: qrContext(),
    mark: null,
    message: '',
    confirm: mock.confirm,
    readOwn: mock.read,
    canRead: true,
    reading: false,
    rateLimited: false,
    abandon: vi.fn(),
  });
});

describe('student mobile QR view', () => {
  it('renders a readable session and explicit action without triggering a write', () => {
    const html = renderToStaticMarkup(<StudentQrAttendance />);

    expect(html).toContain('Registrar asistencia');
    expect(html).toContain('Materia de prueba');
    expect(html).toContain('Confirmar asistencia');
    expect(html).toContain('Horario de Bolivia');
    expect(html).not.toContain(qrToken());
    expect(html).not.toContain('latitude');
    expect(mock.confirm).not.toHaveBeenCalled();

    const button = elements<ComponentProps<typeof Button>>(StudentQrAttendance(), Button).find(
      (item) => item.props.children === 'Confirmar asistencia',
    )!;

    button.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(mock.confirm).toHaveBeenCalledTimes(1);
  });
  it('shows manual EXCUSED accurately without another check-in action', () => {
    mock.hook.mockReturnValue({
      phase: 'ALREADY_REGISTERED',
      context: qrContext(),
      mark: { ...qrMark, status: 'EXCUSED', registrationMethod: 'MANUAL' },
      message: 'Tu registro está confirmado',
      canRead: true,
      readOwn: mock.read,
    });
    const html = renderToStaticMarkup(<StudentQrAttendance />);

    expect(html).toContain('Permiso');
    expect(html).toContain('Registro manual');
    expect(html).not.toContain('Confirmar asistencia');
  });
  it.each(['INITIALIZING', 'LOADING_CONTEXT', 'SUBMITTING'])(
    'announces accessible %s loading and disables repeat confirmation',
    (phase) => {
      mock.hook.mockReturnValue({ phase, context: null, mark: null, message: '', canRead: false });
      const html = renderToStaticMarkup(<StudentQrAttendance />);

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');

      if (phase === 'SUBMITTING') {
        expect(html).toContain('Registrando asistencia...');
        expect(html).not.toContain('Cargando...');
      } else {
        expect(html).toContain('Cargando...');
      }

      expect(html).not.toContain('Confirmar asistencia');
    },
  );
  it('does not claim failure or repeat the write after an uncertain result', () => {
    mock.hook.mockReturnValue({
      phase: 'UNCERTAIN',
      context: qrContext(),
      mark: null,
      message: 'La solicitud todavía podría completarse',
      canRead: true,
      readOwn: mock.read,
    });
    const html = renderToStaticMarkup(<StudentQrAttendance />);

    expect(html).toContain('todavía podría');
    expect(html).toContain('Consultar mi registro');
    expect(html).not.toContain('Confirmar asistencia');
  });
});

it.each(['READY_FOR_LOCATION', 'LOCATING', 'READY_TO_CONFIRM'])(
  'shows combined consent and the correct actions in %s',
  (phase) => {
    const locate = vi.fn();

    mock.hook.mockReturnValue({
      phase,
      context: { ...qrContext(), mode: 'GEOLOCATION_QR' },
      remaining: 80,
      locate,
      confirm: mock.confirm,
      mark: null,
      rateLimited: false,
      canRead: true,
      readOwn: mock.read,
    });
    const html = renderToStaticMarkup(<StudentQrAttendance />);

    expect(html).toContain('Obtener mi ubicación');
    expect(html).toContain('no se guardan tus coordenadas exactas');
    expect(html).toContain('80');
    if (phase === 'READY_TO_CONFIRM') expect(html).toContain('Confirmar asistencia');
    else expect(html).not.toContain('Confirmar asistencia');
    expect(locate).not.toHaveBeenCalled();
    expect(mock.confirm).not.toHaveBeenCalled();
  },
);
