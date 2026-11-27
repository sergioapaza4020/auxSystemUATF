import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, RadioGroup, TextField } from '@mui/material';

import { AttendanceCreateDialog } from './AttendanceCreateDialog';
import { DateField } from '@/components/DateField';
import { elements, hookHarness } from '@/test-utils/hook-harness';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));

describe('attendance creation mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T14:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  it('uses Bolivia today as minimum and blocks direct past-date confirmation', () => {
    vi.setSystemTime(new Date('2026-10-27T03:59:59Z'));
    const onCreate = vi.fn();
    const h = hookHarness(() => AttendanceCreateDialog({ initialDate: '2026-10-25', onCreate, onClose: vi.fn() }));
    const field = elements<React.ComponentProps<typeof DateField>>(h.render(), DateField)[0].props;

    expect(field.minDate).toBe('2026-10-26');
    expect(field.error).toBe(true);

    const create = elements<React.ComponentProps<typeof Button>>(h.render(), Button).find(
      (item) => item.props.children === 'Crear sesión',
    )!.props;

    expect(create.disabled).toBe(true);
    create.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(onCreate).not.toHaveBeenCalled();
    h.unmount();
  });
  it.each(['MANUAL', 'GEOLOCATION', 'QR', 'GEOLOCATION_QR'] as const)(
    'creates %s only on confirmation and lets a locked session start another date',
    (mode) => {
      const onCreate = vi.fn();
      const h = hookHarness(() => AttendanceCreateDialog({ initialDate: '2026-10-26', onCreate, onClose: vi.fn() }));
      let tree = h.render();

      expect(elements<React.ComponentProps<typeof RadioGroup>>(tree, RadioGroup)[0].props.value).toBe('GEOLOCATION_QR');
      elements<React.ComponentProps<typeof RadioGroup>>(tree, RadioGroup)[0].props.onChange?.(
        {} as React.ChangeEvent<HTMLInputElement>,
        mode,
      );
      elements<React.ComponentProps<typeof DateField>>(tree, DateField)[0].props.onChange('2026-10-27');
      tree = h.render();
      expect(onCreate).not.toHaveBeenCalled();

      const create = elements<React.ComponentProps<typeof Button>>(tree, Button).find(
        (item) => item.props.children === 'Crear sesión',
      );

      create?.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
      expect(onCreate).toHaveBeenCalledWith(mode, '2026-10-27');
      h.unmount();
    },
  );
  it('offers an optional topic and sends its trimmed value', () => {
    const onCreate = vi.fn();
    const h = hookHarness(() => AttendanceCreateDialog({ initialDate: '2026-10-26', onCreate, onClose: vi.fn() }));

    const field = elements<React.ComponentProps<typeof TextField>>(h.render(), TextField).find(
      (f) => f.props.label === 'Tema de la clase',
    )!.props;

    expect(field.required).not.toBe(true);
    expect(field.inputProps?.maxLength).toBe(255);
    field.onChange?.({ target: { value: '  Introducción a Git  ' } } as React.ChangeEvent<HTMLInputElement>);
    elements<React.ComponentProps<typeof Button>>(h.render(), Button)
      .find((b) => b.props.variant === 'contained')!
      .props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
    expect(onCreate).toHaveBeenCalledWith('GEOLOCATION_QR', '2026-10-26', 'Introducción a Git');
    h.unmount();
  });
});
