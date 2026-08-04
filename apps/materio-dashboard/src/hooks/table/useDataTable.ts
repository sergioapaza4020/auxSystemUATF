'use client';

import { useMemo, useState } from 'react';

import { type HeadCell, type Order, getComparator, type SortableIds } from '@/components/table';

export function useDataTable<T, TColumns extends readonly HeadCell<T>[]>(
  rows: T[],
  defaultOrderBy: SortableIds<T, TColumns>,
  defaultRowsPerPage = 5,
) {
  const [order, setOrder] = useState<Order>('desc');

  const [orderBy, setOrderBy] = useState<SortableIds<T, TColumns>>(defaultOrderBy);

  const [page, setPage] = useState(0);

  const [rowsPerPage, setRowsPerPage] = useState(defaultRowsPerPage);

  const visibleRows = useMemo(
    () => [...rows].sort(getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [rows, order, orderBy, page, rowsPerPage],
  );

  const handleRequestSort = (_: React.MouseEvent<unknown>, property: SortableIds<T, TColumns>) => {
    const isAsc = orderBy === property && order === 'asc';

    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  };

  return {
    order,
    orderBy,

    page,
    rowsPerPage,

    visibleRows,

    handleRequestSort,
    handleChangePage,
    handleChangeRowsPerPage,
  };
}
