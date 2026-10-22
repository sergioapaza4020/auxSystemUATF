import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SnackbarContext } from '@/contexts/SnackbarContext';
import type { SnackbarContextType } from '@/contexts/SnackbarContext';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { SnackbarProvider } from './SnackbarProvider';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('@/components/feedback/AppSnackbar', () => ({ AppSnackbar: () => null }));
beforeEach(() => vi.resetAllMocks());
describe('Snackbar handlers', () => {
  it('keeps handlers stable while showing and closing notifications', () => {
    const h = hookHarness(() => SnackbarProvider({ children: null }));
    const context = () => elements<{ value: SnackbarContextType }>(h.render(), SnackbarContext.Provider)[0].props.value;
    const initial = context();

    initial.error('Forbidden');
    const shown = context();

    expect(shown.snackbar.open).toBe(true);
    expect(shown.error).toBe(initial.error);
    expect(shown.closeSnackbar).toBe(initial.closeSnackbar);
    shown.closeSnackbar();
    const closed = context();

    expect(closed.snackbar.open).toBe(false);

    for (const handler of ['error', 'success', 'info', 'warning', 'closeSnackbar'] as const) {
      expect(closed[handler]).toBe(initial[handler]);
    }

    h.unmount();
  });
});
