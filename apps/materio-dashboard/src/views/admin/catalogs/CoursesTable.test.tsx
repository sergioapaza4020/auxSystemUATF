import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableRow } from '@mui/material';

import { useCatalogPage } from '@/hooks/useCatalogPage';
import { getCoursesPage } from '@/api/courses.service';
import { PaginationTable } from '@/components/table';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { CatalogToolbar } from './CatalogToolbar';
import { ReferenceCatalogTable } from './ReferenceCatalogTable';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useEffect: vi.fn(),
  useRef: vi.fn(),
  useMemo: vi.fn(),
  useCallback: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { roles: ['SUPERADMIN'], permissions: [] }, loading: false }),
}));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({ error: vi.fn() }) }));
vi.mock('@/hooks/useCatalogPage', () => ({ useCatalogPage: vi.fn() }));
vi.mock('@/api/courses.service', () => ({ getCoursesPage: vi.fn() }));
vi.mock('@/components/users/RemoteUserSelect', () => ({ RemoteUserSelect: () => null }));

const changeQuery = vi.fn();

const state = () => ({
  query: { page: 2, limit: 5, search: 'remote search', status: 'inactive' as const },
  rows: [{ idCourse: 123, code: 'SIS', name: 'Servidor', group: 1, isActive: false }],
  meta: { page: 2, limit: 5, total: 71, totalPages: 15 },
  loading: false,
  error: '',
  changeQuery,
  reload: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCatalogPage).mockReturnValue(state());
});

describe('Courses remote table', () => {
  it('uses the server page without slicing or filtering it and displays the server total', () => {
    const h = hookHarness(() => ReferenceCatalogTable({ kind: 'courses' }));
    const tree = h.render();

    expect(useCatalogPage).toHaveBeenCalledWith(getCoursesPage, true);
    expect(elements(tree, TableRow)).toHaveLength(2);
    const pager = elements<React.ComponentProps<typeof PaginationTable>>(tree, PaginationTable)[0].props;

    expect(pager).toMatchObject({ count: 71, page: 1, rowsPerPage: 5 });
    pager.onPageChange(null, 2);
    expect(changeQuery).toHaveBeenLastCalledWith({ page: 3 });
    pager.onRowsPerPageChange({ target: { value: '25' } } as React.ChangeEvent<HTMLInputElement>);
    expect(changeQuery).toHaveBeenLastCalledWith({ limit: 25 });
    const toolbar = elements<React.ComponentProps<typeof CatalogToolbar>>(tree, CatalogToolbar)[0].props;

    toolbar.onSearch('nuevo');
    expect(changeQuery).toHaveBeenLastCalledWith({ search: 'nuevo' });
    toolbar.onStatus('active');
    expect(changeQuery).toHaveBeenLastCalledWith({ status: 'active' });
    h.unmount();
  });
});
