'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  DataTableContainer,
  DataTableSurface,
  PaginationTable,
  TableMessageRow,
  TableToolbar,
  TableAction,
} from '@/components/table';

import {
  createFaculty,
  deactivateFaculty,
  getFaculties,
  reactivateFaculty,
  updateFaculty,
} from '@/api/faculties.service';

import { RemoteUserSelect } from '@/components/users/RemoteUserSelect';

import { useDataTable } from '@/hooks/table';
import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';

import type { IFaculty } from '@/interfaces/faculties/faculty.interface';
import type { IUser } from '@/interfaces/users/user.interface';

import { hasPermission } from '@/utils/hasPermission';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const columns = [{ id: 'name', label: 'Nombre', sortable: true }] as const;

export function FacultiesTable() {
  const { user, loading } = useAuth();
  const snackbar = useSnackbar();

  const request = useRef(0);
  const [listLoading, setListLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [rows, setRows] = useState<IFaculty[]>([]);
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const [search, setSearch] = useState('');

  const [edit, setEdit] = useState<IFaculty | null | undefined>(undefined);

  const [name, setName] = useState('');
  const [dean, setDean] = useState<IUser[]>([]);
  const [busy, setBusy] = useState(false);

  const can = useCallback((action: string) => hasPermission(user, `faculty.${action}`), [user]);

  const load = useCallback(async () => {
    const revision = ++request.current;

    setListLoading(true);
    setLoadError('');

    try {
      const result = await getFaculties(status);

      if (request.current === revision) setRows(result);
    } catch (e) {
      if (request.current === revision) {
        setLoadError(getApiErrorMessage(e));
        snackbar.error(getApiErrorMessage(e));
      }
    } finally {
      if (request.current === revision) setListLoading(false);
    }
  }, [status, snackbar]);

  useEffect(() => {
    if (!loading && can('get-all')) void load();

    return () => {
      request.current += 1;
    };
  }, [loading, load, can]);

  const filtered = rows.filter((row) => row.name.toLowerCase().includes(search.toLowerCase()));
  const table = useDataTable<IFaculty, typeof columns>(filtered, 'name', 5, { preserveOrder: true });

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

      <DataTableSurface variant='outlined'>
        <TableToolbar onRefresh={() => void load()} refreshDisabled={busy || listLoading}>
          <TextField
            size='small'
            label='Buscar facultad'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              table.handleChangePage(null, 0);
            }}
          />

          <TextField
            select
            size='small'
            label='Estado'
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as typeof status);
              table.handleChangePage(null, 0);
            }}
            SelectProps={{
              native: true,
            }}
          >
            <option value='all'>Todas</option>
            <option value='active'>Activas</option>
            <option value='inactive'>Inactivas</option>
          </TextField>
        </TableToolbar>

        <DataTableContainer aria-busy={listLoading}>
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
              {listLoading ? (
                <TableMessageRow colSpan={4} loading />
              ) : loadError ? (
                <TableMessageRow colSpan={4}>{loadError}</TableMessageRow>
              ) : (
                table.visibleRows.map((row) => (
                  <TableRow key={row.idFaculty}>
                    <TableCell>{row.name}</TableCell>

                    <TableCell>{row.dean ? `${row.dean.name} ${row.dean.lastname}` : '—'}</TableCell>

                    <TableCell>{row.isActive ? 'Activa' : 'Inactiva'}</TableCell>

                    <TableCell>
                      <Stack direction='row' spacing={0.75} alignItems='center'>
                        {row.isActive && can('update') && (
                          <TableAction intent='edit' label='Editar' disabled={busy} onClick={() => open(row)} />
                        )}

                        {can(row.isActive ? 'delete' : 'reactivate') && (
                          <TableAction
                            intent={row.isActive ? 'deactivate' : 'activate'}
                            label={row.isActive ? 'Desactivar' : 'Reactivar'}
                            disabled={busy}
                            onClick={() => void toggleStatus(row)}
                          />
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {!listLoading && !loadError && !filtered.length && (
                <TableMessageRow colSpan={4}>Sin resultados</TableMessageRow>
              )}
            </TableBody>
          </Table>
        </DataTableContainer>
        {!loadError && (
          <PaginationTable
            count={filtered.length}
            page={table.page}
            rowsPerPage={table.rowsPerPage}
            onPageChange={table.handleChangePage}
            onRowsPerPageChange={table.handleChangeRowsPerPage}
            disabled={listLoading || busy}
          />
        )}
      </DataTableSurface>

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
