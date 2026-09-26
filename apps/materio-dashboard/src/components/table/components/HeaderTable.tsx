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
            sx={{
              py: 2,

              bgcolor: 'action.hover',

              color: 'text.secondary',

              fontSize: '0.75rem',

              fontWeight: 700,

              letterSpacing: '0.02em',

              whiteSpace: 'nowrap',

              borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            {headCell.sortable ? (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id)}
                sx={{
                  color: 'inherit',

                  '&:hover': {
                    color: 'text.primary',
                  },

                  '&.Mui-active': {
                    color: 'text.primary',
                  },

                  '& .MuiTableSortLabel-icon': {
                    fontSize: '1.1rem',
                  },
                }}
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
