import type * as React from 'react';

import { describe, expect, it, vi } from 'vitest';
import { Button, RadioGroup } from '@mui/material';

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
  it.each(['MANUAL', 'GEOLOCATION', 'QR'] as const)(
    'creates %s only on confirmation and lets a locked session start another date',
    (mode) => {
      const onCreate = vi.fn();
      const h = hookHarness(() => AttendanceCreateDialog({ initialDate: '2026-10-26', onCreate, onClose: vi.fn() }));
      let tree = h.render();

      expect(elements<React.ComponentProps<typeof RadioGroup>>(tree, RadioGroup)[0].props.value).toBe('MANUAL');
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
});
