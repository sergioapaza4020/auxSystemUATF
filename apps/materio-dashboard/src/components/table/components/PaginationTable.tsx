import { Pagination, Select, MenuItem, Stack, Typography } from '@mui/material';

export interface PaginationTableProps {
  count: number;
  rowsPerPage: number;
  page: number;
  onPageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;
  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  rowsPerPageOptions?: readonly number[];
  disabled?: boolean;
}

export function PaginationTable({
  count,
  rowsPerPage,
  page,
  onPageChange,
  onRowsPerPageChange,
  rowsPerPageOptions = [5, 10, 25],
  disabled = false,
}: PaginationTableProps) {
  const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const validPage = page >= 0 && page < totalPages;
  const from = count === 0 || !validPage ? 0 : page * rowsPerPage + 1;
  const to = count === 0 || !validPage ? 0 : Math.min((page + 1) * rowsPerPage, count);

  const sizes = rowsPerPageOptions.includes(rowsPerPage)
    ? rowsPerPageOptions
    : [...rowsPerPageOptions, rowsPerPage].sort((a, b) => a - b);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent='space-between'
      spacing={2}
      sx={{ px: 3, py: 2, minWidth: 0, borderTop: 1, borderColor: 'divider' }}
    >
      <Typography role='status' aria-live='polite' variant='body2' color='text.secondary'>
        Mostrando {from}-{to} de {count} resultados
      </Typography>
      <Stack
        direction='row'
        alignItems='center'
        justifyContent={{ xs: 'flex-start', sm: 'flex-end' }}
        spacing={2}
        useFlexGap
        flexWrap='wrap'
        sx={{ minWidth: 0 }}
      >
        <Stack direction='row' alignItems='center' spacing={1}>
          <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'nowrap' }}>
            Filas por página:
          </Typography>
          <Select
            size='small'
            value={rowsPerPage}
            disabled={disabled}
            inputProps={{ 'aria-label': 'Filas por página' }}
            onChange={(event) => {
              if (!disabled && Number(event.target.value) !== rowsPerPage)
                onRowsPerPageChange(event as React.ChangeEvent<HTMLInputElement>);
            }}
            sx={{ minWidth: 70, '& .MuiSelect-select': { py: 1 } }}
          >
            {sizes.map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </Stack>
        <Pagination
          count={totalPages}
          page={safePage + 1}
          shape='rounded'
          color='primary'
          siblingCount={0}
          boundaryCount={1}
          disabled={disabled || count === 0}
          aria-label='Paginación de la tabla'
          getItemAriaLabel={(type, target, selected) =>
            type === 'page'
              ? `${selected ? 'Página actual' : 'Ir a la página'} ${target}`
              : type === 'previous'
                ? 'Página anterior'
                : type === 'next'
                  ? 'Página siguiente'
                  : type === 'first'
                    ? 'Primera página'
                    : 'Última página'
          }
          sx={{ '& .MuiPagination-ul': { flexWrap: 'wrap', rowGap: 1 } }}
          onChange={(_, newPage) => {
            if (!disabled && count > 0 && newPage - 1 !== page) onPageChange(null, newPage - 1);
          }}
        />
      </Stack>
    </Stack>
  );
}
