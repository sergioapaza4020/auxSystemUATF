'use client';

import { useEffect, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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

import {
  createFaculty,
  deactivateFaculty,
  getFaculties,
  reactivateFaculty,
  updateFaculty,
} from '@/api/faculties.service';

import { RemoteUserSelect } from '@/components/users/RemoteUserSelect';

import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';

import type { IFaculty } from '@/interfaces/faculties/faculty.interface';
import type { IUser } from '@/interfaces/users/user.interface';

import { hasPermission } from '@/utils/hasPermission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export function FacultiesTable() {
  const { user, loading } = useAuth();
  const snackbar = useSnackbar();

  const [rows, setRows] = useState<IFaculty[]>([]);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [search, setSearch] = useState('');

  const [edit, setEdit] = useState<IFaculty | null | undefined>(undefined);

  const [name, setName] = useState('');
  const [dean, setDean] = useState<IUser[]>([]);
  const [busy, setBusy] = useState(false);

  const can = (action: string) => hasPermission(user, `faculty.${action}`);

  const load = async () => {
    try {
      setRows(await getFaculties(status));
    } catch (e) {
      snackbar.error(getApiErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!loading && can('get-all')) {
      void load();
    }
  }, [loading, load, can]);

  if (loading) {
    return <Typography>Cargando…</Typography>;
  }

  if (!can('get-all')) {
    return <Alert severity='warning'>No tienes permiso para consultar facultades.</Alert>;
  }

  const open = (item: IFaculty | null) => {
    setEdit(item);
    setName(item?.name ?? '');
    setDean(item?.dean ? [item.dean] : []);
  };

  const save = async () => {
    if (!name.trim() || !dean[0]) {
      return;
    }

    setBusy(true);

    try {
      const data = {
        name: name.trim(),
        idDean: dean[0].idUser,
      };

      if (edit) {
        await updateFaculty(edit.idFaculty, data);
      } else {
        await createFaculty(data);
      }

      setEdit(undefined);

      await load();

      snackbar.success('Facultad guardada.');
    } catch (e) {
      snackbar.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (row: IFaculty) => {
    setBusy(true);

    try {
      if (row.isActive) {
        await deactivateFaculty(row.idFaculty);
      } else {
        await reactivateFaculty(row.idFaculty);
      }

      await load();
    } catch (e) {
      snackbar.error(getApiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const filtered = rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Stack spacing={3}>
      <Stack direction='row' justifyContent='space-between' alignItems='center'>
        <Typography variant='h4'>Facultades</Typography>

        {can('create') && (
          <Button variant='contained' onClick={() => open(null)}>
            Crear facultad
          </Button>
        )}
      </Stack>

      <Paper variant='outlined'>
        <Stack
          direction={{
            xs: 'column',
            sm: 'row',
          }}
          spacing={2}
          sx={{ p: 2 }}
        >
          <TextField size='small' label='Buscar facultad' value={search} onChange={(e) => setSearch(e.target.value)} />

          <TextField
            select
            size='small'
            label='Estado'
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            SelectProps={{
              native: true,
            }}
          >
            <option value='all'>Todas</option>
            <option value='active'>Activas</option>
            <option value='inactive'>Inactivas</option>
          </TextField>

          <Button onClick={() => void load()}>Actualizar</Button>
        </Stack>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nombre</TableCell>
              <TableCell>Decano</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.idFaculty}>
                <TableCell>{row.name}</TableCell>

                <TableCell>{row.dean ? `${row.dean.name} ${row.dean.lastname}` : '—'}</TableCell>

                <TableCell>{row.isActive ? 'Activa' : 'Inactiva'}</TableCell>

                <TableCell>
                  {row.isActive && can('update') && (
                    <Button size='small' onClick={() => open(row)}>
                      Editar
                    </Button>
                  )}

                  {can(row.isActive ? 'delete' : 'reactivate') && (
                    <Button
                      size='small'
                      color={row.isActive ? 'error' : 'success'}
                      disabled={busy}
                      onClick={() => void toggleStatus(row)}
                    >
                      {row.isActive ? 'Desactivar' : 'Reactivar'}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog
        open={edit !== undefined}
        onClose={() => {
          if (!busy) {
            setEdit(undefined);
          }
        }}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>{edit ? 'Editar' : 'Crear'} facultad</DialogTitle>

        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label='Nombre' value={name} onChange={(e) => setName(e.target.value)} required />

            <RemoteUserSelect value={dean} onChange={setDean} multiple={false} role='DEAN' label='Decano' />
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setEdit(undefined)} disabled={busy}>
            Cancelar
          </Button>

          <Button variant='contained' disabled={busy || !name.trim() || !dean.length} onClick={() => void save()}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
