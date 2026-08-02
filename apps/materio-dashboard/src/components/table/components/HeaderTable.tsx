import { TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material';

import type { Order } from '../types/order';
import type { HeadCell } from '../types/headCell';
import type { SortableIds } from '@/components/table/types/sortableIds';

interface EnhancedTableHeadProps<T, TColumns extends readonly HeadCell<T>[]> {
  headCells: TColumns;
  onRequestSort: (event: React.MouseEvent<unknown>, property: SortableIds<T, TColumns>) => void;
  order: Order;
  orderBy: SortableIds<T, TColumns>;
}

export function EnhancedTableHead<T, const TColumns extends readonly HeadCell<T>[]>(
  props: EnhancedTableHeadProps<T, TColumns>,
) {
  const { headCells, onRequestSort, order, orderBy } = props;

  const createSortHandler = (property: SortableIds<T, TColumns>) => (event: React.MouseEvent<unknown>) => {
    onRequestSort(event, property);
  };

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell) => (
          <TableCell
            key={headCell.id}
            sortDirection={headCell.sortable && orderBy === headCell.id ? order : false}
            align={headCell.align}
            padding={headCell.disablePadding ? 'none' : 'normal'}
            width={headCell.width}
          >
            {headCell.sortable ? (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id)}
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
