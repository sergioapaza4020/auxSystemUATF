'use client';

import { useCallback } from 'react';

import {
  Alert,
  Button,
  LinearProgress,
  Box,
  Chip,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TablePagination,
  TableRow,
  TableHead,
  TextField,
  Typography,
} from '@mui/material';

import { type HeadCell } from '@/components/table';
import { useDataTable } from '@/hooks/table/useDataTable';
import type {
  ICareerStudentImportRow,
  ICareerStudentImportPreview,
} from '@/interfaces/careers/career-student-import.interface';
import { getCareerStudentImportPreviewPage } from '@/api/careers.service';
import { useImportPreview } from '@/hooks/imports/useImportPreview';
import type { ImportPreviewQuery } from '@/interfaces/import-preview.interface';

const columns = [
  { id: 'row', label: 'Fila', sortable: true },
  { id: 'fullName', label: 'Estudiante', sortable: false },
  { id: 'ru', label: 'RU', sortable: false },
  { id: 'username', label: 'Username', sortable: false },
  { id: 'email', label: 'Email', sortable: false },
  { id: 'currentCareer', label: 'Carrera actual', sortable: false },
  { id: 'status', label: 'Estado', sortable: false },
  { id: 'errors', label: 'Errores', sortable: false },
] as const satisfies readonly HeadCell<ICareerStudentImportRow>[];

export function CareerStudentImportReviewTable({
  preview,
  careerId,
  busy,
}: {
  preview: ICareerStudentImportPreview;
  careerId: number;
  busy: boolean;
}) {
  const loadPage = useCallback(
    (operationId: string, query: ImportPreviewQuery, signal?: AbortSignal) =>
      getCareerStudentImportPreviewPage(careerId, operationId, query, signal),
    [careerId],
  );

  const remote = useImportPreview(preview, !busy, loadPage);

  const table = useDataTable<ICareerStudentImportRow, typeof columns>(remote.rows, 'row', 25, {
    preserveOrder: true,
    remote: { ...remote.query, changeQuery: remote.changeQuery },
  });

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label='Buscar nombre, RU, username, email o carrera'
          size='small'
          value={remote.query.search}
          disabled={busy}
          sx={{ flex: 1 }}
          onChange={(event) => {
            remote.changeQuery({ search: event.target.value });
          }}
        />
        <TextField
          select
          label='Estado'
          size='small'
          value={remote.query.status}
          disabled={busy}
          sx={{ minWidth: 180 }}
          onChange={(event) => {
            remote.changeQuery({ status: event.target.value as ImportPreviewQuery['status'] });
          }}
        >
          <MenuItem value='all'>Todos</MenuItem>
          <MenuItem value='valid'>Válidos</MenuItem>
          <MenuItem value='invalid'>Con errores</MenuItem>
        </TextField>
      </Stack>
      {remote.loading && <LinearProgress aria-label='Cargando página del preview' />}
      {remote.error && (
        <Alert
          severity='error'
          action={
            <Button onClick={remote.reload} disabled={busy || remote.loading}>
              Reintentar
            </Button>
          }
        >
          {remote.error}
        </Alert>
      )}
      <TableContainer aria-busy={remote.loading} sx={{ opacity: remote.loading || remote.error ? 0.6 : 1 }}>
        <Table size='small' aria-label='Revisión de estudiantes a asignar' sx={{ minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id}>{column.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {table.visibleRows.map((row) => (
              <TableRow key={row.row} sx={{ bgcolor: row.status === 'VALID' ? undefined : 'action.hover' }}>
                <TableCell>{row.row}</TableCell>
                <TableCell>
                  <Typography variant='body2'>{row.fullName || '—'}</Typography>
                </TableCell>
                <TableCell>{row.ru || '—'}</TableCell>
                <TableCell>{row.username || '—'}</TableCell>
                <TableCell>{row.email || '—'}</TableCell>
                <TableCell>{row.currentCareer?.name || '—'}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    variant='outlined'
                    color={row.status === 'VALID' ? 'success' : 'error'}
                    label={row.status === 'VALID' ? 'Válido' : 'Con errores'}
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
            {!table.visibleRows.length && (
              <TableRow>
                <TableCell colSpan={8} align='center' sx={{ py: 6 }}>
                  No hay filas que coincidan con la búsqueda y el filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component='div'
        count={remote.meta.total}
        page={table.page}
        rowsPerPage={table.rowsPerPage}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage='Filas por página'
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        onPageChange={(event, page) => {
          if (!busy) table.handleChangePage(event, page);
        }}
        onRowsPerPageChange={table.handleChangeRowsPerPage}
        SelectProps={{ disabled: busy }}
        backIconButtonProps={{ disabled: busy || table.page === 0 }}
        nextIconButtonProps={{ disabled: busy || (table.page + 1) * table.rowsPerPage >= remote.meta.total }}
      />
    </>
  );
}
