import { TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';

import type { Order } from './types/order';
import type { HeadCell } from './types/headCell';
import type { SortableIds } from '@/utils/getSortableItems';

interface EnhancedTableHeadProps<T> {
  headCells: readonly HeadCell<T>[];
  onRequestSort: (event: React.MouseEvent<unknown>, property: SortableIds<T, readonly HeadCell<T>[]>) => void;
  order: Order;
  orderBy: string;
}

export function EnhancedTableHead<T>(props: EnhancedTableHeadProps<T>) {
  const { headCells, onRequestSort, order, orderBy } = props;

  const createSortHandler =
    (property: SortableIds<T, readonly HeadCell<T>[]>) => (event: React.MouseEvent<unknown>) => {
      onRequestSort(event, property);
    };

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell: HeadCell<T>) => (
          <TableCell key={headCell.id} sortDirection={orderBy === headCell.id ? order : false}>
            {headCell.sortable ? (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id as SortableIds<T, readonly HeadCell<T>[]>)}
              >
                {headCell.label}
              </TableSortLabel>
            ) : (
              headCell.label
            )}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}
