'use client';

import {
  Alert,
  Button,
  LinearProgress,
  Box,
  Chip,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableRow,
  TableHead,
  TextField,
  Typography,
} from '@mui/material';

import { DataTableContainer, PaginationTable, TableToolbar } from '@/components/table';

import { type HeadCell } from '@/components/table';
import { useDataTable } from '@/hooks/table/useDataTable';
import type {
  IEnrollmentImportRow,
  IEnrollmentImportPreview,
} from '@/interfaces/enrollments/enrollment-import.interface';
import { getEnrollmentImportPreviewPage } from '@/api/enrollments.service';
import { useImportPreview } from '@/hooks/imports/useImportPreview';
import type { ImportPreviewQuery } from '@/interfaces/import-preview.interface';
import { enrollmentImportActionLabel } from './enrollment-import';

const columns = [
  { id: 'row', label: 'Fila', sortable: true },
  { id: 'fullName', label: 'Estudiante', sortable: false },
  { id: 'ru', label: 'RU', sortable: false },
  { id: 'username', label: 'Username', sortable: false },
  { id: 'email', label: 'Email', sortable: false },
  { id: 'status', label: 'Estado', sortable: false },
  { id: 'errors', label: 'Errores', sortable: false },
] as const satisfies readonly HeadCell<IEnrollmentImportRow>[];

export function EnrollmentImportReviewTable({ preview, busy }: { preview: IEnrollmentImportPreview; busy: boolean }) {
  const remote = useImportPreview(preview, !busy, getEnrollmentImportPreviewPage);

  const table = useDataTable<IEnrollmentImportRow, typeof columns>(remote.rows, 'row', 25, {
    preserveOrder: true,
    remote: { ...remote.query, changeQuery: remote.changeQuery },
  });

  return (
    <>
      <TableToolbar compact onRefresh={remote.reload} refreshDisabled={busy || remote.loading}>
        <TextField
          label='Buscar nombre, RU, username o email'
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
      </TableToolbar>
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
      <DataTableContainer aria-busy={remote.loading} sx={{ opacity: remote.loading || remote.error ? 0.6 : 1 }}>
        <Table size='small' aria-label='Revisión de estudiantes a matricular' sx={{ minWidth: 950 }}>
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
                <TableCell>
                  <Chip
                    size='small'
                    variant='outlined'
                    color={row.action === 'SKIP' ? 'default' : row.status === 'VALID' ? 'success' : 'error'}
                    label={enrollmentImportActionLabel(row)}
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
                <TableCell colSpan={7} align='center' sx={{ py: 6 }}>
                  No hay filas que coincidan con la búsqueda y el filtro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DataTableContainer>
      <PaginationTable
        count={remote.meta.total}
        page={table.page}
        rowsPerPage={table.rowsPerPage}
        rowsPerPageOptions={[25, 50, 100]}
        disabled={busy || remote.loading}
        onPageChange={table.handleChangePage}
        onRowsPerPageChange={table.handleChangeRowsPerPage}
      />
    </>
  );
}
