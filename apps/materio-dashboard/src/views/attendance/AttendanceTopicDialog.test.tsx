import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, TextField } from '@mui/material';

import { AttendanceTopicDialog } from './AttendanceTopicDialog';
import { elements, hookHarness, deferred } from '@/test-utils/hook-harness';
import type { IAttendanceSession } from '@/interfaces/attendances/attendance.interface';

const mocks = vi.hoisted(() => ({ update: vi.fn(), success: vi.fn(), warning: vi.fn() }));

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('@/api/attendances.service', () => ({ updateAttendanceSessionTopic: mocks.update }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue({ topic: 'Tema' });
});

const session = {
  idAttendanceSession: 7,
  topic: 'Tema anterior',
  mode: 'GEOLOCATION_QR',
  state: 'CLOSED',
} as IAttendanceSession;

function setup() {
  const saved = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn();
  const h = hookHarness(() => AttendanceTopicDialog({ session, onSaved: saved, onClose: close }));

  return { ...h, saved, close };
}

const input = (tree: React.ReactNode) => elements<React.ComponentProps<typeof TextField>>(tree, TextField)[0].props;

const button = (tree: React.ReactNode) =>
  elements<React.ComponentProps<typeof Button>>(tree, Button).find((b) => b.props.variant === 'contained')!.props;

describe('session topic metadata editor', () => {
  it.each([
    ['  Arquitectura de software  ', 'Arquitectura de software'],
    ['', null],
    ['   ', null],
    ['Sin tema', null],
  ])('sends only topic on explicit save (%j)', async (value, expected) => {
    const h = setup();

    expect(input(h.render()).value).toBe('Tema anterior');
    input(h.render()).onChange?.({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
    expect(mocks.update).not.toHaveBeenCalled();
    await button(h.render()).onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(7, expected);
    expect(h.saved).toHaveBeenCalledOnce();
    h.unmount();
  });
  it('blocks oversized values, synchronously prevents double saves and retains errors', async () => {
    const h = setup();

    input(h.render()).onChange?.({ target: { value: 'a'.repeat(256) } } as React.ChangeEvent<HTMLInputElement>);
    expect(button(h.render()).disabled).toBe(true);
    input(h.render()).onChange?.({ target: { value: 'Un tema válido' } } as React.ChangeEvent<HTMLInputElement>);
    const pending = deferred<{ topic: string }>();

    mocks.update.mockReturnValueOnce(pending.promise);
    const control = button(h.render());
    const first = control.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    const second = control.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

    expect(mocks.update).toHaveBeenCalledOnce();
    pending.reject(new Error('Sin conexión'));
    await Promise.all([first, second]);
    expect(input(h.render()).value).toBe('Un tema válido');
    expect(h.close).not.toHaveBeenCalled();
    h.unmount();
  });
});
