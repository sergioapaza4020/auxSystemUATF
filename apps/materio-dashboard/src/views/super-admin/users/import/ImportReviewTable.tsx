'use client';

import {
  Alert,
  Button,
  Box,
  Chip,
  MenuItem,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { useUserImportPreview } from '@/hooks/users/useUserImportPreview';
import type { IUserImportPreview, UserImportStatus } from '@/interfaces/users/user-import.interface';

const columns = ['Fila', 'Nombre / username', 'CI', 'RU', 'Email', 'Estado', 'Errores'];

export function ImportReviewTable({ preview, busy }: { preview: IUserImportPreview; busy: boolean }) {
  const table = useUserImportPreview(preview, !busy);

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label='Buscar nombre, apellido, username, CI, RU o email'
          size='small'
          value={table.query.search}
          disabled={busy}
          sx={{ flex: 1 }}
          onChange={(event) => {
            table.changeQuery({ search: event.target.value });
          }}
        />
        <TextField
          select
          label='Estado'
          size='small'
          value={table.query.status}
          disabled={busy}
          sx={{ minWidth: 180 }}
          onChange={(event) => {
            table.changeQuery({ status: event.target.value as UserImportStatus });
          }}
        >
          <MenuItem value='all'>Todos</MenuItem>
          <MenuItem value='valid'>Válidos</MenuItem>
          <MenuItem value='invalid'>Con errores</MenuItem>
        </TextField>
      </Stack>
      {table.loading && <LinearProgress aria-label='Cargando página del preview' />}
      {table.error && (
        <Alert
          severity='error'
          action={
            <Button disabled={busy || table.loading} onClick={table.reload}>
              Reintentar
            </Button>
          }
        >
          No se pudo cargar la página. {table.error}
        </Alert>
      )}
      <TableContainer aria-busy={table.loading} sx={{ opacity: table.loading || table.error ? 0.6 : 1 }}>
        <Table size='small' aria-label='Revisión de usuarios a importar' sx={{ minWidth: 950 }}>
          {/* Remote rows retain PostgreSQL rowNumber ordering, as in UsersTable. */}
          <TableHead>
            <TableRow>
              {columns.map((label) => (
                <TableCell key={label}>{label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {table.rows.map((row) => (
              <TableRow key={row.row} sx={{ bgcolor: row.valid ? undefined : 'action.hover' }}>
                <TableCell>{row.row - 1}</TableCell>
                <TableCell>
                  <Typography variant='body2'>
                    {row.name} {row.lastname}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {row.username || '—'}
                  </Typography>
                </TableCell>
                <TableCell>{row.ci || '—'}</TableCell>
                <TableCell>{row.ru || '—'}</TableCell>
                <TableCell>{row.email || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    variant='outlined'
                    color={row.valid ? 'success' : 'error'}
                    label={row.valid ? 'Válido' : 'Con errores'}
                  />
                </TableCell>
                <TableCell sx={{ minWidth: 240 }}>
                  {row.errors.length ? (
                    <Box component='ul' sx={{ m: 0, pl: 4 }}>
                      {row.errors.map((error, index) => (
                        <Typography component='li' variant='body2' color='error' key={index}>
                          {error}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!table.rows.length && !table.loading && !table.error && (
              <TableRow>
                <TableCell colSpan={7} align='center' sx={{ py: 6 }}>
                  No hay filas que coincidan con la búsqueda y el filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component='div'
        count={table.meta.total}
        page={table.meta.page - 1}
        rowsPerPage={table.meta.limit}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage='Filas por página'
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        onPageChange={(event, page) => {
          if (!busy && !table.loading) table.changeQuery({ page: page + 1 });
        }}
        onRowsPerPageChange={(event) => table.changeQuery({ limit: Number(event.target.value) })}
        SelectProps={{ disabled: busy || table.loading }}
        backIconButtonProps={{ disabled: busy || table.loading || table.meta.page === 1 }}
        nextIconButtonProps={{ disabled: busy || table.loading || table.meta.page >= table.meta.totalPages }}
      />
    </>
  );
}
