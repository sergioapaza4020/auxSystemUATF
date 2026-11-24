import type * as React from 'react';

import { beforeEach, expect, it, vi } from 'vitest';
import { TextField } from '@mui/material';

import { PaginationTable, TableToolbar } from '@/components/table';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { RolesTable } from './RolesTable';
import { RoleRow } from './components/RoleRow';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ load: vi.fn().mockResolvedValue(undefined), error: vi.fn() }));

vi.mock('@/hooks/roles', () => ({
  useRoles: () => ({
    roles: Array.from({ length: 12 }, (_, index) => ({
      idRole: index + 1,
      name: `Rol ${index + 1}`,
      description: 'Descripción',
      permissions: [],
      isActive: index % 2 === 0,
    })),
    loading: false,
    load: mocks.load,
  }),
  useRoleMutations: () => ({ loading: false }),
}));
vi.mock('@/hooks/permissions', () => ({ usePermissions: () => ({ permissions: [], loading: false }) }));
vi.mock('@/hooks/useDialog', () => ({ useDialog: () => ({ error: mocks.error }) }));

beforeEach(() => {
  vi.clearAllMocks();
});
type FieldProps = React.ComponentProps<typeof TextField>;

const change = (tree: React.ReactNode, label: string, value: string) =>
  elements<FieldProps>(tree, TextField)
    .find((field) => field.props.label === label)
    ?.props.onChange?.({ target: { value } } as React.ChangeEvent<HTMLInputElement>);

const pager = (tree: React.ReactNode) =>
  elements<React.ComponentProps<typeof PaginationTable>>(tree, PaginationTable)[0].props;

it('filters complete roles before pagination, combines status, resets the page and preserves context on refresh', () => {
  const h = hookHarness(RolesTable);
  let tree = h.render();

  expect(pager(tree).count).toBe(12);
  pager(tree).onPageChange(null, 2);
  tree = h.render();
  expect(elements(tree, RoleRow)).toHaveLength(2);
  change(tree, 'Buscar rol', 'Rol 1');
  tree = h.render();
  expect(pager(tree)).toMatchObject({ count: 4, page: 0 });
  change(tree, 'Estado', 'active');
  tree = h.render();
  expect(pager(tree).count).toBe(2);
  elements<React.ComponentProps<typeof TableToolbar>>(tree, TableToolbar)[0].props.onRefresh?.();
  expect(mocks.load).toHaveBeenCalledOnce();
  expect(pager(h.render()).count).toBe(2);
  h.unmount();
});

it('reports a refresh error without clearing current roles', async () => {
  mocks.load.mockRejectedValueOnce(new Error('Offline'));
  const h = hookHarness(RolesTable);
  const tree = h.render();

  elements<React.ComponentProps<typeof TableToolbar>>(tree, TableToolbar)[0].props.onRefresh?.();
  await Promise.resolve();
  expect(mocks.error).toHaveBeenCalledWith('No se pudieron actualizar los roles.');
  expect(pager(h.render()).count).toBe(12);
  h.unmount();
});
