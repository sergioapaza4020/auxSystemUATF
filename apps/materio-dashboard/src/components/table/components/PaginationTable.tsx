import { TablePagination } from '@mui/material';

interface PaginationTableProps {
  count: number;
  rowsPerPage: number;
  page: number;
  onPageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  darkMode?: boolean;
}

export function PaginationTable(props: PaginationTableProps) {
  const { count, rowsPerPage, page, onPageChange, onRowsPerPageChange, darkMode } = props;

  return (
    <TablePagination
      labelRowsPerPage='Filas por página:'
      labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
      rowsPerPageOptions={[5, 10, 25]}
      component='div'
      count={count}
      rowsPerPage={rowsPerPage}
      page={page}
      onPageChange={onPageChange}
      onRowsPerPageChange={onRowsPerPageChange}
      slotProps={{
        select: {
          MenuProps: {
            PaperProps: {
              sx: {
                '& .MuiMenuItem-root.Mui-selected': {
                  ...(darkMode && { color: '#fff' }),
                },
              },
            },
          },
        },
      }}
    />
  );
}
