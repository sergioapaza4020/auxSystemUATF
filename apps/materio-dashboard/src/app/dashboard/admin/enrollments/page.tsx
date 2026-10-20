'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  MenuItem,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { deactivateEnrollment, reactivateEnrollment } from '@/api/enrollments.service';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { useEnrollmentsPage } from '@/hooks/enrollments/useEnrollmentsPage';
import type { RecordStatus } from '@/interfaces/status-query.interface';

export default function EnrollmentsPage() {
  const { user, loading } = useAuth();
  const snackbar = useSnackbar();
  const notification = useRef(snackbar);

  notification.current = snackbar;
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const can = useCallback((action: string) => hasPermission(user, `enrollment.${action}`), [user]);

  const {
    rows,
    query,
    meta,
    loading: loadingPage,
    error,
    changeQuery,
    reload,
  } = useEnrollmentsPage(!loading && can('get-all'));

  const { page, limit, total, totalPages } = meta;

  useEffect(() => {
    if (error) notification.current.error(error);
  }, [error]);

  if (loading) return <Typography>Cargando…</Typography>;
  if (!can('get-all')) return <Alert severity='warning'>No tienes permiso para consultar matrículas.</Alert>;

  return (
    <Stack spacing={3}>
      <Typography variant='h4'>Matrículas</Typography>
      <Paper variant='outlined'>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
          <TextField
            size='small'
            label='Buscar usuario o curso'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && changeQuery({ search })}
          />
          <TextField
            select
            size='small'
            label='Estado'
            value={query.status}
            onChange={(e) => changeQuery({ status: e.target.value as RecordStatus })}
          >
            <MenuItem value='all'>Todos</MenuItem>
            <MenuItem value='active'>Activos</MenuItem>
            <MenuItem value='inactive'>Inactivos</MenuItem>
          </TextField>
          <Button onClick={() => changeQuery({ search })}>Buscar</Button>
        </Stack>
        {loadingPage && <LinearProgress />}
        <Table aria-busy={loadingPage}>
          <TableHead>
            <TableRow>
              <TableCell>Usuario</TableCell>
              <TableCell>Curso</TableCell>
              <TableCell>Semestre</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.idEnrollment}>
                <TableCell>
                  {row.user?.name} {row.user?.lastname}
                  <br />
                  {row.user?.username}
                </TableCell>
                <TableCell>
                  {row.course?.code} · {row.course?.name}
                </TableCell>
                <TableCell>
                  {row.semester?.period}-{row.semester?.year}
                </TableCell>
                <TableCell>{row.role}</TableCell>
                <TableCell>{row.isActive ? 'Activo' : 'Inactivo'}</TableCell>
                <TableCell>
                  {row.isActive && can('delete') ? (
                    <Button
                      color='error'
                      size='small'
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);

                        try {
                          await deactivateEnrollment(row.idEnrollment);
                          reload();
                          snackbar.success('Matrícula desactivada.');
                        } catch (e) {
                          snackbar.error(getApiErrorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Desactivar
                    </Button>
                  ) : !row.isActive && can('reactivate') ? (
                    <Button
                      color='success'
                      size='small'
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);

                        try {
                          await reactivateEnrollment(row.idEnrollment);
                          reload();
                          snackbar.success('Matrícula reactivada.');
                        } catch (e) {
                          snackbar.error(getApiErrorMessage(e));
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Reactivar
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ p: 2 }}>
          <TextField
            select
            size='small'
            label='Filas por página'
            value={limit}
            onChange={(event) => changeQuery({ limit: Number(event.target.value) })}
          >
            {[20, 50, 100].map((value) => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <Button disabled={page <= 1} onClick={() => changeQuery({ page: page - 1 })}>
            Anterior
          </Button>
          <Typography>
            Página {page} de {Math.max(1, totalPages)} · {total}
          </Typography>
          <Button disabled={page >= totalPages} onClick={() => changeQuery({ page: page + 1 })}>
            Siguiente
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
