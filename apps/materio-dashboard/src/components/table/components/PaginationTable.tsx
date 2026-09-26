import { Pagination, Select, MenuItem, Stack, Typography } from '@mui/material';

interface PaginationTableProps {
  count: number;
  rowsPerPage: number;
  page: number;

  onPageChange: (event: React.MouseEvent<HTMLButtonElement> | null, page: number) => void;

  onRowsPerPageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function PaginationTable({ count, rowsPerPage, page, onPageChange, onRowsPerPageChange }: PaginationTableProps) {
  const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));

  const from = count === 0 ? 0 : page * rowsPerPage + 1;

  const to = Math.min((page + 1) * rowsPerPage, count);

  return (
    <Stack
      direction={{
        xs: 'column',
        sm: 'row',
      }}
      alignItems={{
        xs: 'stretch',
        sm: 'center',
      }}
      justifyContent='space-between'
      spacing={2}
      sx={{
        px: 3,
        py: 2,

        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant='body2' color='text.secondary'>
        Mostrando {from}-{to} de {count} resultados
      </Typography>

      <Stack
        direction='row'
        alignItems='center'
        justifyContent={{
          xs: 'space-between',
          sm: 'flex-end',
        }}
        spacing={2}
      >
        <Stack direction='row' alignItems='center' spacing={1}>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{
              whiteSpace: 'nowrap',
            }}
          >
            Filas por página:
          </Typography>

          <Select
            size='small'
            value={rowsPerPage}
            onChange={(event) => {
              onRowsPerPageChange(event as React.ChangeEvent<HTMLInputElement>);
            }}
            sx={{
              minWidth: 70,

              '& .MuiSelect-select': {
                py: 1,
              },
            }}
          >
            {[5, 10, 25].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </Select>
        </Stack>

        <Pagination
          count={totalPages}
          page={page + 1}
          shape='rounded'
          color='primary'
          siblingCount={0}
          boundaryCount={1}
          onChange={(_, newPage) => {
            onPageChange(null, newPage - 1);
          }}
        />
      </Stack>
    </Stack>
  );
}
