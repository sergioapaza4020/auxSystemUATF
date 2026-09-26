'use client';
import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  MenuItem,
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

import { deactivateEnrollment, getEnrollmentsPage, reactivateEnrollment } from '@/api/enrollments.service';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

export default function EnrollmentsPage() {
  const { user, loading } = useAuth();
  const snackbar = useSnackbar();
  const can = (action: string) => hasPermission(user, `enrollment.${action}`);
  const [rows, setRows] = useState<IEnrollment[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [busy, setBusy] = useState(false);

  const load = async (nextPage = page) => {
    try {
      const response = await getEnrollmentsPage({
        page: nextPage,
        limit: 20,
        status: status as 'active' | 'inactive' | 'all',
        search: search || undefined,
      });

      setRows(response.data);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
      setTotal(response.meta.total);
    } catch (e) {
      snackbar.error(getApiErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!loading && can('get-all')) void load(1);
  }, [loading, status, can, load]);
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
            onKeyDown={(e) => e.key === 'Enter' && void load(1)}
          />
          <TextField select size='small' label='Estado' value={status} onChange={(e) => setStatus(e.target.value)}>
            <MenuItem value='all'>Todos</MenuItem>
            <MenuItem value='active'>Activos</MenuItem>
            <MenuItem value='inactive'>Inactivos</MenuItem>
          </TextField>
          <Button onClick={() => void load(1)}>Buscar</Button>
        </Stack>
        <Table>
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
                          await load();
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
                          await load();
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
        <Stack direction='row' justifyContent='space-between' sx={{ p: 2 }}>
          <Button disabled={page <= 1} onClick={() => void load(page - 1)}>
            Anterior
          </Button>
          <Typography>
            Página {page} de {totalPages} · {total}
          </Typography>
          <Button disabled={page >= totalPages} onClick={() => void load(page + 1)}>
            Siguiente
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
