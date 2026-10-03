'use client';

import { useMemo, useState } from 'react';

import {
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
  TextField,
  Typography,
} from '@mui/material';

import { EnhancedTableHead, type HeadCell } from '@/components/table';
import { useDataTable } from '@/hooks/table/useDataTable';
import type { ICareerStudentImportRow } from '@/interfaces/careers/career-student-import.interface';
import { filterCareerStudentImportRows, type CareerStudentImportFilter } from './career-student-import';

const columns = [
  { id: 'row', label: 'Fila', sortable: true },
  { id: 'fullName', label: 'Estudiante', sortable: true },
  { id: 'ru', label: 'RU', sortable: true },
  { id: 'username', label: 'Username', sortable: true },
  { id: 'email', label: 'Email', sortable: true },
  { id: 'currentCareer', label: 'Carrera actual', sortable: false },
  { id: 'status', label: 'Estado', sortable: true },
  { id: 'errors', label: 'Errores', sortable: false },
] as const satisfies readonly HeadCell<ICareerStudentImportRow>[];

export function CareerStudentImportReviewTable({ rows, busy }: { rows: ICareerStudentImportRow[]; busy: boolean }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CareerStudentImportFilter>('all');
  const filtered = useMemo(() => filterCareerStudentImportRows(rows, search, filter), [rows, search, filter]);
  const table = useDataTable<ICareerStudentImportRow, typeof columns>(filtered, 'row', 25);

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label='Buscar nombre, RU, username, email o carrera'
          size='small'
          value={search}
          disabled={busy}
          sx={{ flex: 1 }}
          onChange={(event) => {
            setSearch(event.target.value);
            table.handleChangePage(null, 0);
          }}
        />
        <TextField
          select
          label='Estado'
          size='small'
          value={filter}
          disabled={busy}
          sx={{ minWidth: 180 }}
          onChange={(event) => {
            setFilter(event.target.value as CareerStudentImportFilter);
            table.handleChangePage(null, 0);
          }}
        >
          <MenuItem value='all'>Todos</MenuItem>
          <MenuItem value='VALID'>Válidos</MenuItem>
          <MenuItem value='INVALID'>Con errores</MenuItem>
        </TextField>
      </Stack>
      <TableContainer>
        <Table size='small' aria-label='Revisión de estudiantes a asignar' sx={{ minWidth: 1100 }}>
          <EnhancedTableHead<ICareerStudentImportRow, typeof columns>
            headCells={columns}
            order={table.order}
            orderBy={table.orderBy}
            onRequestSort={(event, property) => {
              if (!busy) table.handleRequestSort(event, property);
            }}
          />
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
        count={filtered.length}
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
        nextIconButtonProps={{ disabled: busy || (table.page + 1) * table.rowsPerPage >= filtered.length }}
      />
    </>
  );
}
