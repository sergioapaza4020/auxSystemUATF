import type * as React from 'react';

import { describe, expect, it, vi } from 'vitest';

import { hookHarness } from '@/test-utils/hook-harness';
import { useDataTable } from './useDataTable';

vi.mock('react', async () => ({
  ...(await vi.importActual<typeof React>('react')),
  useState: vi.fn(),
  useRef: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useMemo: vi.fn(),
}));

const columns = [{ id: 'name', label: 'Nombre', sortable: true }] as const;

type Row = { name: string };
const rows = ['A', 'B', 'C', 'D', 'E', 'F'].map((name) => ({ name }));
const sizeEvent = (value: string) => ({ target: { value } }) as React.ChangeEvent<HTMLInputElement>;

describe('useDataTable local and remote integrity', () => {
  it('sorts the complete collection before slicing and resets the page on sort', () => {
    const h = hookHarness(() => useDataTable<Row, typeof columns>(rows, 'name', 2));

    expect(h.render().visibleRows.map((row) => row.name)).toEqual(['F', 'E']);
    h.render().handleChangePage(null, 2);
    expect(h.render().visibleRows.map((row) => row.name)).toEqual(['B', 'A']);
    h.render().handleRequestSort({} as React.MouseEvent, 'name');
    expect(h.render()).toMatchObject({ page: 0, order: 'asc', visibleRows: rows.slice(0, 2) });
    h.unmount();
  });

  it('reconciles deletion and filtering without jumping back when results grow', () => {
    let data = rows;
    const h = hookHarness(() => useDataTable<Row, typeof columns>(data, 'name', 2, { preserveOrder: true }));

    h.render().handleChangePage(null, 2);
    expect(h.render().visibleRows).toEqual(rows.slice(4));
    data = rows.slice(0, 4);
    expect(h.render()).toMatchObject({ page: 1, visibleRows: rows.slice(2, 4) });
    data = rows;
    expect(h.render().page).toBe(1);
    data = [];
    expect(h.render()).toMatchObject({ page: 0, visibleRows: [] });
    h.unmount();
  });

  it('changes local size while keeping input order and resets the page', () => {
    const h = hookHarness(() => useDataTable<Row, typeof columns>(rows, 'name', 2, { preserveOrder: true }));

    h.render().handleChangePage(null, 2);
    h.render().handleChangeRowsPerPage(sizeEvent('5'));
    expect(h.render()).toMatchObject({ page: 0, rowsPerPage: 5, visibleRows: rows.slice(0, 5) });
    h.unmount();
  });

  it('never re-slices server rows and converts UI page zero to API page one', () => {
    const changeQuery = vi.fn();

    const h = hookHarness(() =>
      useDataTable<Row, typeof columns>(rows.slice(0, 1), 'name', 5, {
        remote: { page: 7, limit: 25, changeQuery },
      }),
    );

    expect(h.render()).toMatchObject({ page: 6, rowsPerPage: 25, visibleRows: rows.slice(0, 1) });
    h.render().handleChangePage(null, 0);
    expect(changeQuery).toHaveBeenLastCalledWith({ page: 1 });
    h.render().handleChangeRowsPerPage(sizeEvent('10'));
    expect(changeQuery).toHaveBeenLastCalledWith({ limit: 10 });
    h.unmount();
  });
});
