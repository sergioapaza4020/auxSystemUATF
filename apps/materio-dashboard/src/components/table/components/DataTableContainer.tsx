import { Card, TableContainer } from '@mui/material';
import type { PaperProps, TableContainerProps } from '@mui/material';

// AttendanceHistory's visual language with the roomier density requested in phase two.
export const dataTableCellSx = {
  px: 2,
  py: 1.5,
  typography: 'body2',
  color: 'text.primary',
  borderBottom: 1,
  borderColor: 'divider',
} as const;

export const dataTableHeadCellSx = {
  ...dataTableCellSx,
  py: 2,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  textTransform: 'none',
  bgcolor: 'background.paper',
} as const;

export const dataTableGridRowSx = {
  px: 2,
  py: 1.5,
  typography: 'body2',
  borderBottom: 1,
  borderColor: 'divider',
} as const;

/** Presentation only. Rows, headers, spans, selection and editing stay with the caller. */
export function DataTableContainer({ sx, ...props }: TableContainerProps) {
  return (
    <TableContainer
      {...props}
      sx={[
        {
          width: '100%',
          maxWidth: '100%',
          overflowX: 'auto',
          borderRadius: 'inherit',
          '& > table': { width: '100%', borderCollapse: 'collapse', typography: 'body2' },
          '& > table > thead > tr > th, & > table > thead > tr > td': dataTableHeadCellSx,
          '& > table > tbody > tr > td:not([colspan]):not(.MuiTableCell-paddingNone):not(.MuiTableCell-paddingCheckbox), & > table > tbody > tr > th:not([colspan]):not(.MuiTableCell-paddingNone):not(.MuiTableCell-paddingCheckbox)':
            dataTableCellSx,
          '& > table > tbody > tr:not(.Mui-selected):hover': { bgcolor: 'action.hover' },
          '& .MuiTableSortLabel-root:focus-visible, & button:focus-visible': {
            outline: '2px solid',
            outlineColor: 'primary.main',
            outlineOffset: 2,
          },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}

/** The same Card shell as AttendanceHistory, without a module-specific toolbar. */
export function DataTableSurface({ sx, ...props }: PaperProps) {
  return (
    <Card
      {...props}
      sx={[...(Array.isArray(sx) ? sx : [sx]), { minWidth: 0, maxWidth: '100%', borderRadius: 1, overflow: 'hidden' }]}
    />
  );
}
