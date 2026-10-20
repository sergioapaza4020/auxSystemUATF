import type * as React from 'react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Button, TextField } from '@mui/material';

import { getEnrollmentsPage } from '@/api/enrollments.service';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import EnrollmentsPage from './page';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/api/enrollments.service', () => ({ getEnrollmentsPage: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ loading: false, user: { roles: [], permissions: ['enrollment.get-all'] } }),
}));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ error: vi.fn() }) }));

type FieldProps = React.ComponentProps<typeof TextField>;
type ButtonProps = React.ComponentProps<typeof Button>;
const event = (value: string) => ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>;

const click = (tree: React.ReactNode, label: string) =>
  elements<ButtonProps>(tree, Button)
    .find((element) => element.props.children === label)
    ?.props.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

const field = (tree: React.ReactNode, label: string) =>
  elements<FieldProps>(tree, TextField).find((element) => element.props.label === label)?.props;

let cleanup: () => void;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.mocked(getEnrollmentsPage).mockImplementation(async (query) => ({
    status: true,
    statusCode: 200,
    data: [],
    meta: { page: query.page, limit: query.limit, total: 100, totalPages: Math.ceil(100 / query.limit) },
  }));
});
afterEach(() => {
  cleanup?.();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Administrative enrollment page connection', () => {
  it('navigates to page 2; typing stays local until Buscar; status and page size reset the query', async () => {
    const harness = hookHarness(EnrollmentsPage);

    cleanup = harness.unmount;
    harness.render();
    await vi.runAllTimersAsync();
    click(harness.render(), 'Siguiente');
    harness.render();
    await vi.runAllTimersAsync();
    let tree = harness.render();

    expect(vi.mocked(getEnrollmentsPage).mock.calls.map(([query]) => query.page)).toEqual([1, 2]);
    field(tree, 'Buscar usuario o curso')?.onChange?.(event('Ana'));
    tree = harness.render();
    await vi.runAllTimersAsync();
    expect(getEnrollmentsPage).toHaveBeenCalledTimes(2);
    click(tree, 'Buscar');
    harness.render();
    await vi.runAllTimersAsync();
    expect(getEnrollmentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'Ana', page: 1 }),
      expect.any(AbortSignal),
    );
    click(harness.render(), 'Siguiente');
    harness.render();
    await vi.runAllTimersAsync();
    field(harness.render(), 'Estado')?.onChange?.(event('inactive'));
    harness.render();
    await vi.runAllTimersAsync();
    expect(getEnrollmentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'inactive', page: 1 }),
      expect.any(AbortSignal),
    );
    click(harness.render(), 'Siguiente');
    harness.render();
    await vi.runAllTimersAsync();
    field(harness.render(), 'Filas por página')?.onChange?.(event('50'));
    harness.render();
    await vi.runAllTimersAsync();
    expect(getEnrollmentsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 50, page: 1 }),
      expect.any(AbortSignal),
    );
  });
});
