'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  Alert,
  LinearProgress,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { deactivatePermission, getPermissions, reactivatePermission } from '@/api/permissions.service';
import { EnhancedTableHead, PaginationTable, StatusChip, TableActions } from '@/components/table';
import type { HeadCell } from '@/components/table';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/utils/hasPermission';
import { useAdministrativeCatalog } from '@/hooks/catalogs/useAdministrativeCatalog';
import { useDataTable } from '@/hooks/table';
import type { IPermission } from '@/interfaces/permissions/permission.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { CatalogToolbar } from '@/views/admin/catalogs/CatalogToolbar';
import { permissionPrefix } from './permission-rules';

type PermissionRow = IPermission & { prefix: string };

const columns = [
  { id: 'name', label: 'Clave / nombre', sortable: true },
  { id: 'description', label: 'Descripción', sortable: true },
  { id: 'prefix', label: 'Grupo / prefijo', sortable: true },
  { id: 'isActive', label: 'Estado', sortable: true },
  { id: 'actions', label: 'Acciones', sortable: false },
] as const satisfies readonly HeadCell<PermissionRow>[];

const fetchPermissions = () => getPermissions('all');

export function PermissionsTable() {
  const { user, loading: authLoading } = useAuth();
  const can = (action: string) => hasPermission(user, `permission.${action}`);
  const catalog = useAdministrativeCatalog(fetchPermissions, !authLoading && can('get-all'));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RecordStatus>('all');
  const [prefix, setPrefix] = useState('');

  const groups = useMemo(
    () => [...new Set(catalog.records.map((permission) => permissionPrefix(permission.name)))].sort(),
    [catalog.records],
  );

  const filtered = useMemo(
    () =>
      catalog.records
        .map((permission) => ({ ...permission, prefix: permissionPrefix(permission.name) }))
        .filter(
          (permission) =>
            `${permission.name} ${permission.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()) &&
            (status === 'all' || permission.isActive === (status === 'active')) &&
            (!prefix || permission.prefix === prefix),
        ),
    [catalog.records, search, status, prefix],
  );

  const table = useDataTable<PermissionRow, typeof columns>(filtered, 'name', 10);
  const { page, rowsPerPage, handleChangePage } = table;

  useEffect(() => {
    if (page > Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1)) handleChangePage(null, 0);
  }, [filtered.length, page, rowsPerPage, handleChangePage]);

  if (authLoading) return <LoadingTable />;
  if (!can('get-all')) return <Alert severity='warning'>No tienes permiso para consultar este catálogo.</Alert>;

  const changeState = async (permission: IPermission) => {
    if (!can(permission.isActive ? 'delete' : 'reactivate')) return;
    await catalog.mutate(
      () =>
        permission.isActive
          ? deactivatePermission(permission.idPermission)
          : reactivatePermission(permission.idPermission),
      permission.isActive ? 'Permiso desactivado en el catálogo.' : 'Permiso reactivado.',
      undefined,
      {
        title: `${permission.isActive ? 'Desactivar' : 'Reactivar'} «${permission.name}»`,
        text: permission.isActive
          ? 'Dejará de estar disponible para nuevas asignaciones. Esto no revoca por sí solo los accesos de roles que ya lo tienen asignado.'
          : 'Volverá a estar disponible en el catálogo de asignación de Roles.',
        confirmButtonText: permission.isActive ? 'Desactivar' : 'Reactivar',
      },
    );
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent='space-between' spacing={2}>
        <Typography variant='h4' component='h1'>
          Catálogo de permisos
        </Typography>
      </Stack>
      <Alert severity='info'>
        Aquí se mantiene el catálogo. La asignación de permisos se realiza en Roles. Las claves existentes no se
        renombran.
      </Alert>
      {catalog.mutationError && <Alert severity='error'>{catalog.mutationError}</Alert>}
      {catalog.busy && <LinearProgress aria-label='Guardando cambios' />}
      <Paper variant='outlined' sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <CatalogToolbar
          search={search}
          searchLabel='Buscar clave o descripción'
          onSearch={(value) => {
            setSearch(value);
            handleChangePage(null, 0);
          }}
          status={status}
          onStatus={(value) => {
            setStatus(value);
            handleChangePage(null, 0);
          }}
          onReload={() => void catalog.load()}
          disabled={catalog.busy || catalog.loading}
        />
        <Box sx={{ px: 3, pb: 3 }}>
          <TextField
            select
            fullWidth
            size='small'
            label='Grupo / prefijo'
            value={prefix}
            onChange={(event) => {
              setPrefix(event.target.value);
              handleChangePage(null, 0);
            }}
          >
            <MenuItem value=''>Todos los grupos</MenuItem>
            {groups.map((group) => (
              <MenuItem key={group} value={group}>
                {group === '(sin prefijo)' ? group : `${group}.*`} (
                {catalog.records.filter((permission) => permissionPrefix(permission.name) === group).length})
              </MenuItem>
            ))}
          </TextField>
        </Box>
        {catalog.loading ? (
          <Box sx={{ p: 3 }} role='status' aria-label='Cargando permisos'>
            <LoadingTable />
          </Box>
        ) : catalog.error ? (
          <Alert
            severity='error'
            sx={{ m: 3 }}
            action={<Button onClick={() => void catalog.load()}>Reintentar</Button>}
          >
            {catalog.error}
          </Alert>
        ) : (
          <>
            <TableContainer>
              <Table aria-label='Catálogo de permisos' sx={{ minWidth: 700 }}>
                <EnhancedTableHead<PermissionRow, typeof columns>
                  headCells={columns}
                  order={table.order}
                  orderBy={table.orderBy}
                  onRequestSort={table.handleRequestSort}
                />
                <TableBody>
                  {table.visibleRows.map((permission) => (
                    <TableRow hover key={permission.idPermission}>
                      <TableCell sx={{ overflowWrap: 'anywhere' }}>{permission.name}</TableCell>
                      <TableCell sx={{ maxWidth: 400, overflowWrap: 'anywhere' }}>
                        {permission.description || 'Sin descripción'}
                      </TableCell>
                      <TableCell>
                        <Chip size='small' label={permission.prefix} />
                      </TableCell>
                      <TableCell>
                        <StatusChip active={permission.isActive} />
                      </TableCell>
                      <TableCell>
                        <TableActions
                          active={permission.isActive}
                          disabled={catalog.busy}
                          onDelete={can('delete') ? () => void changeState(permission) : undefined}
                          onRestore={can('reactivate') ? () => void changeState(permission) : undefined}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filtered.length && (
                    <TableRow>
                      <TableCell colSpan={5} align='center' sx={{ py: 6 }}>
                        <Typography>
                          {catalog.records.length
                            ? 'No hay permisos que coincidan con los filtros.'
                            : 'Todavía no hay permisos registrados.'}
                        </Typography>
                        {(search || prefix || status !== 'all') && (
                          <Button
                            onClick={() => {
                              setSearch('');
                              setStatus('all');
                              setPrefix('');
                              handleChangePage(null, 0);
                            }}
                          >
                            Limpiar filtros
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <PaginationTable
              count={filtered.length}
              page={page}
              rowsPerPage={rowsPerPage}
              onPageChange={handleChangePage}
              onRowsPerPageChange={table.handleChangeRowsPerPage}
            />
          </>
        )}
      </Paper>
    </Stack>
  );
}
