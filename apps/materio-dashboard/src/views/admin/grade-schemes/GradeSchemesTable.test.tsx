import type * as React from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TextField } from '@mui/material';

import { EnhancedTableHead, PaginationTable } from '@/components/table';
import { useGradeSchemes } from '@/hooks/grade-schemes';
import { elements, hookHarness } from '@/test-utils/hook-harness';
import { GradeSchemesTable } from './GradeSchemesTable';
import { GradeSchemeRow } from './components/GradeSchemeRow';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));
vi.mock('@/hooks/useDialog', () => ({ useDialog: () => ({}) }));
vi.mock('@/hooks/useSnackbar', () => ({ useSnackbar: () => ({}) }));
vi.mock('@/hooks/grade-schemes', () => ({
  useGradeSchemes: vi.fn(),
  useGradeSchemeMutations: () => ({}),
  useGradeSchemeEditor: () => ({ open: false, openEditor: vi.fn() }),
}));
const changeQuery = vi.fn();

const state = (): ReturnType<typeof useGradeSchemes> => ({
  query: {
    page: 3,
    limit: 5,
    search: 'backend filter',
    status: 'inactive',
    sortBy: 'idGradeScheme',
    sortOrder: 'DESC',
  },
  gradeSchemes: [{ idGradeScheme: 11, name: 'Server row', isActive: false, details: [] }],
  rows: [],
  meta: { page: 3, limit: 5, total: 44, totalPages: 9 },
  loading: false,
  error: '',
  changeQuery,
  reload: vi.fn(),
  load: vi.fn(),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useGradeSchemes).mockReturnValue(state());
});

describe('GradeSchemes server pagination', () => {
  it('renders the returned page without a second slice or filter, using the filtered total', () => {
    const h = hookHarness(GradeSchemesTable);
    const tree = h.render();

    expect(elements(tree, GradeSchemeRow)).toHaveLength(1);
    const pager = elements<React.ComponentProps<typeof PaginationTable>>(tree, PaginationTable)[0].props;

    expect(pager).toMatchObject({ count: 44, page: 2, rowsPerPage: 5 });
    pager.onPageChange(null, 3);
    expect(changeQuery).toHaveBeenLastCalledWith({ page: 4 });
    pager.onRowsPerPageChange({ target: { value: '25' } } as React.ChangeEvent<HTMLInputElement>);
    expect(changeQuery).toHaveBeenLastCalledWith({ limit: 25 });
    h.unmount();
  });
  it.each(['search', 'status'])('delegates %s to remote query state', (filter) => {
    const h = hookHarness(GradeSchemesTable);
    const tree = h.render();

    const field = elements<React.ComponentProps<typeof TextField>>(tree, TextField).find((item) =>
      filter === 'search' ? !!item.props.placeholder : !!item.props.select,
    )!;

    field.props.onChange?.({
      target: { value: filter === 'search' ? 'Nuevo' : 'active' },
    } as React.ChangeEvent<HTMLInputElement>);
    expect(changeQuery).toHaveBeenLastCalledWith(filter === 'search' ? { search: 'Nuevo' } : { status: 'active' });
    h.unmount();
  });
  it('requests global sorting instead of sorting only the current page', () => {
    const h = hookHarness(GradeSchemesTable);
    const tree = h.render();

    const header = elements<{ onRequestSort: (event: React.MouseEvent<unknown>, property: 'name') => void }>(
      tree,
      EnhancedTableHead,
    )[0].props;

    header.onRequestSort({} as React.MouseEvent<unknown>, 'name');
    expect(changeQuery).toHaveBeenLastCalledWith({ sortBy: 'name', sortOrder: 'ASC' });
    h.unmount();
  });
});
