import { TableCell, TableHead, TableRow, TableSortLabel } from '@mui/material'

import type { SortableColumn } from './types/sortableColumn'
import type { Order } from './types/order'
import type { HeadCell } from './interfaces/headCell'

interface EnhancedTableHeadProps {
  headCells: HeadCell[]
  onRequestSort: (event: React.MouseEvent<unknown>, property: SortableColumn) => void
  order: Order
  orderBy: string
}

export const EnhancedTableHead = (props: EnhancedTableHeadProps) => {
  const { headCells, onRequestSort, order, orderBy } = props

  const createSortHandler = (property: SortableColumn) => (event: React.MouseEvent<unknown>) => {
    onRequestSort(event, property)
  }

  return (
    <TableHead>
      <TableRow>
        {headCells.map((headCell: HeadCell) => (
          <TableCell key={headCell.id} sortDirection={orderBy === headCell.id ? order : false}>
            {headCell.sortable ? (
              <TableSortLabel
                active={orderBy === headCell.id}
                direction={orderBy === headCell.id ? order : 'asc'}
                onClick={createSortHandler(headCell.id as SortableColumn)}
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
  )
}
