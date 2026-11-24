import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableBody, TableRow, TextField } from '@mui/material';

import { getFaculties } from '@/api/faculties.service';
import { getCareers, getCareerFaculties } from '@/api/careers.service';
import { PaginationTable, TableMessageRow } from '@/components/table';
import { deferred, elements, hookHarness } from '@/test-utils/hook-harness';
import { FacultiesTable } from './FacultiesTable';
import { ReferenceCatalogTable } from './ReferenceCatalogTable';
import { CatalogToolbar } from './CatalogToolbar';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => {
  const auth = { user: { roles: ['SUPERADMIN'], permissions: [] }, loading: false };

  return { useAuth: () => auth };
});
const mocks = vi.hoisted(() => ({ snackbar: { error: vi.fn(), success: vi.fn() }, reload: vi.fn() }));

vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => mocks.snackbar }));
vi.mock('@/hooks/useCatalogPage', () => ({
  useCatalogPage: () => ({
    reload: mocks.reload,
    rows: [],
    query: { page: 1, limit: 5 },
    changeQuery: vi.fn(),
    loading: false,
  }),
}));
vi.mock('@/api/faculties.service', () => ({ getFaculties: vi.fn() }));
vi.mock('@/api/careers.service', () => ({ getCareers: vi.fn(), getCareerFaculties: vi.fn() }));

const rows = Array.from({ length: 11 }, (_, index) => ({
  idFaculty: index + 1,
  idCareer: index + 1,
  name: `Registro ${index + 1}`,
  isActive: index % 2 === 0,
}));

const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

const pager = (tree: React.ReactNode) =>
  elements<React.ComponentProps<typeof PaginationTable>>(tree, PaginationTable)[0].props;

const bodyRows = (tree: React.ReactNode) =>
  elements(elements<{ children: React.ReactNode }>(tree, TableBody)[0].props.children, TableRow);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFaculties).mockResolvedValue(rows);
  vi.mocked(getCareers).mockResolvedValue(rows);
  vi.mocked(getCareerFaculties).mockResolvedValue([]);
});

describe.each(['faculties', 'careers'] as const)('%s complete-collection pagination', (kind) => {
  const mount = () =>
    hookHarness(() => (kind === 'faculties' ? FacultiesTable() : ReferenceCatalogTable({ kind: 'careers' })));

  it('uses the true complete total, changes page and filters before slicing', async () => {
    const h = mount();

    h.render();
    await flush();
    let tree = h.render();

    expect(pager(tree)).toMatchObject({ count: 11, page: 0, rowsPerPage: 5 });
    expect(bodyRows(tree)).toHaveLength(5);
    pager(tree).onPageChange(null, 2);
    tree = h.render();
    expect(bodyRows(tree)).toHaveLength(1);

    if (kind === 'faculties') {
      const search = elements<React.ComponentProps<typeof TextField>>(tree, TextField).find(
        (field) => field.props.label === 'Buscar facultad',
      );

      search?.props.onChange?.({ target: { value: 'Registro 1' } } as React.ChangeEvent<HTMLInputElement>);
    } else {
      elements<React.ComponentProps<typeof CatalogToolbar>>(tree, CatalogToolbar)[0].props.onSearch('Registro 1');
    }

    tree = h.render();
    expect(pager(tree)).toMatchObject({ count: 3, page: 0 });
    expect(bodyRows(tree)).toHaveLength(3);
    h.unmount();
  });
});

it('does not present a faculty HTTP failure as an empty successful list', async () => {
  vi.mocked(getFaculties).mockRejectedValue(new Error('Carga fallida'));
  const h = hookHarness(FacultiesTable);

  h.render();
  await flush();
  const tree = h.render();

  expect(elements(tree, PaginationTable)).toHaveLength(0);
  expect(elements<{ children: React.ReactNode }>(tree, TableMessageRow)[0].props.children).toBeTruthy();
  expect(mocks.snackbar.error).toHaveBeenCalledOnce();
  h.unmount();
});

it('ignores an obsolete faculty response after the status filter changes', async () => {
  const old = deferred<typeof rows>();

  vi.mocked(getFaculties).mockReturnValueOnce(old.promise).mockResolvedValueOnce(rows.slice(0, 1));
  const h = hookHarness(FacultiesTable);
  let tree = h.render();

  elements<React.ComponentProps<typeof TextField>>(tree, TextField)
    .find((field) => field.props.label === 'Estado')
    ?.props.onChange?.({ target: { value: 'active' } } as React.ChangeEvent<HTMLInputElement>);
  h.render();
  await flush();
  old.resolve(rows);
  await flush();
  tree = h.render();
  expect(pager(tree).count).toBe(1);
  h.unmount();
});
