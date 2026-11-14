import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, Box, Button } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';

import { AttendanceQrPresentationDialog } from './AttendanceQrPresentationDialog';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import type { IAttendanceSession } from '@/interfaces/attendances/attendance.interface';

const mock = vi.hoisted(() => ({ hook: vi.fn() }));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/hooks/attendances/useAttendanceQr', () => ({ useAttendanceQr: mock.hook }));
const session = { idAttendanceSession: 7, mode: 'QR', state: 'OPEN' } as IAttendanceSession;
let doc: EventTarget & { fullscreenElement: unknown; exitFullscreen: ReturnType<typeof vi.fn> };
const cleanups: (() => void)[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_ATTENDANCE_QR_ORIGIN', 'https://asistencia.uatf.test');
  doc = Object.assign(new EventTarget(), {
    fullscreenElement: null,
    exitFullscreen: vi.fn().mockResolvedValue(undefined),
  });
  vi.stubGlobal('document', doc);
  mock.hook.mockReturnValue({
    code: { token: 'q1.synthetic' },
    fetching: false,
    remaining: 30,
    error: '',
    retry: vi.fn(),
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((f) => f());
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const setup = () => {
  const h = hookHarness(() =>
    AttendanceQrPresentationDialog({ session, course: 'Materia · Grupo 1', onClose: vi.fn(), onUnavailable: vi.fn() }),
  );

  cleanups.push(h.unmount);

  return h;
};

describe('Local SVG presentation and fullscreen fallback', () => {
  it('renders only the approved URL locally with white margin and no decorative image', () => {
    const h = setup();
    const svg = elements<Parameters<typeof QRCodeSVG>[0]>(h.render(), QRCodeSVG)[0];

    expect(svg.props.value).toBe('https://asistencia.uatf.test/attendance/qr#t=q1.synthetic');
    expect(svg.props.marginSize).toBe(4);
    expect(svg.props.bgColor).toBe('#ffffff');
    expect(svg.props.fgColor).toBe('#000000');
    expect(svg.props.imageSettings).toBeUndefined();
    expect(svg.props.title).not.toContain('q1.synthetic');
    const boxes = elements<React.ComponentProps<typeof Box>>(h.render(), Box);

    expect(boxes.some((box) => JSON.stringify(box.props.sx).includes('100dvh - 360px'))).toBe(true);

    const messages = elements<React.ComponentProps<typeof Alert>>(h.render(), Alert)
      .map((alert) => String(alert.props.children))
      .join(' ');

    expect(messages).toContain('Confirmar asistencia');
    expect(messages).not.toContain('habilitarán en QR-5');
  });
  it('disables the emission hook without a trusted public origin', () => {
    vi.stubEnv('NEXT_PUBLIC_ATTENDANCE_QR_ORIGIN', '');
    setup().render();
    expect(mock.hook).toHaveBeenCalledWith(session, false, expect.any(Function));
  });
  it('keeps the dialog usable when fullscreen is unsupported', async () => {
    const h = setup();
    const tree = h.render();

    const full = elements<React.ComponentProps<typeof Button>>(tree, Button).find(
      (b) => b.props.children === 'Pantalla completa',
    )!;

    await full.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(elements(h.render(), QRCodeSVG)).toHaveLength(1);
  });
});
