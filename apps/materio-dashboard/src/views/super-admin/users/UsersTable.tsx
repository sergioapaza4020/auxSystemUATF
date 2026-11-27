'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Alert,
  LinearProgress,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { DataTableContainer, DataTableSurface, PaginationTable, TableToolbar } from '@/components/table';

import {
  addUserRoles,
  createUser,
  deactivateUser,
  reactivateUser,
  requestUserPasswordReset,
  updateUser,
} from '@/api/users.service';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';
import { useAuth } from '@/hooks/useAuth';
import { useUsersPage } from '@/hooks/users/useUsersPage';
import { useUserMutations } from '@/hooks/users/useUserMutations';
import { useUserRoleOptions } from '@/hooks/users/useUserRoleOptions';
import { hasPermission } from '@/utils/hasPermission';
import type { IUser, IUserCreate, IUserUpdate } from '@/interfaces/users/user.interface';
import type { RecordStatus } from '@/interfaces/status-query.interface';
import { UserRow } from './components/UserRow';
import { UserEditDialog } from './components/UserEditDialog';
import { UserDetailsDialog } from './components/UserDetailsDialog';
import { UserRolesDialog } from './components/UserRolesDialog';

type UserDialog = { type: 'create' } | { type: 'edit' | 'detail' | 'roles' | 'reset'; user: IUser } | null;

export function UsersTable() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading, refreshUser } = useAuth();
  const can = (action: string) => hasPermission(currentUser, `user.${action}`);
  const canReadRoles = hasPermission(currentUser, 'role.get-all');

  const canReset = (user: IUser) =>
    currentUser?.roles.includes('SUPERADMIN') &&
    can('reset-password') &&
    currentUser.idUser !== user.idUser &&
    user.isActive &&
    user.roles?.every((role) => role.name === 'STUDENT' || role.name === 'ASSISTANT');

  const users = useUsersPage(!authLoading && can('get-all'));
  const roles = useUserRoleOptions(!authLoading && can('get-all') && canReadRoles);
  const mutation = useUserMutations(users.reload);
  const [dialog, setDialog] = useState<UserDialog>(null);

  if (authLoading) return <LoadingTable />;
  if (!can('get-all')) return <Alert severity='warning'>No tienes permiso para consultar usuarios.</Alert>;

  const open = (value: UserDialog) => {
    if (mutation.busy) return;
    mutation.clearError();
    setDialog(value);
  };

  const close = () => {
    if (!mutation.busy) setDialog(null);
  };

  const onSaved = (id?: number) => {
    setDialog(null);
    if (id === currentUser?.idUser) void refreshUser();
  };

  const create = async (value: IUserCreate) => {
    if (!can('create')) return;
    await mutation.run(
      () => createUser(value),
      'Usuario creado.',
      () => onSaved(),
    );
  };

  const update = async (value: IUserUpdate) => {
    if (!can('update') || dialog?.type !== 'edit') return;
    const id = dialog.user.idUser;

    await mutation.run(
      () => updateUser(id, value),
      'Usuario actualizado.',
      () => onSaved(id),
    );
  };

  const addRoles = async (names: string[]) => {
    if (!can('assign-roles') || !canReadRoles || dialog?.type !== 'roles' || !names.length) return;
    const id = dialog.user.idUser;

    await mutation.run(
      () => addUserRoles(id, names),
      'Roles añadidos. Los roles anteriores se conservaron.',
      () => onSaved(id),
      {
        title: `Añadir roles a ${dialog.user.username}`,
        text: `Se añadirán: ${names.join(', ')}. Esta pantalla no permite revocar roles.`,
        confirmButtonText: 'Añadir roles',
      },
    );
  };

  const changeState = async (user: IUser) => {
    if (!can(user.isActive ? 'delete' : 'reactivate')) return;
    await mutation.run(
      () => (user.isActive ? deactivateUser(user.idUser) : reactivateUser(user.idUser)),
      user.isActive ? 'Usuario desactivado.' : 'Usuario reactivado.',
      undefined,
      {
        title: `${user.isActive ? 'Desactivar' : 'Reactivar'} usuario ${user.username}`,
        text: user.isActive
          ? `${user.idUser === currentUser?.idUser ? 'Estás desactivando tu propia cuenta. ' : ''}La cuenta dejará de estar activa. Las sesiones existentes se gestionan por separado.`
          : 'La cuenta volverá a estar activa y conservará sus roles.',
        confirmButtonText: user.isActive ? 'Desactivar' : 'Reactivar',
      },
    );
  };

  const hasFilters = !!users.query.search.trim() || !!users.query.role || users.query.status !== 'all';

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent='space-between'>
        <Typography variant='h4' component='h1'>
          Usuarios
        </Typography>
        {can('create') && (
          <Stack direction='row' spacing={2}>
            <Button
              onClick={() => router.push('/dashboard/super-admin/users/import')}
              variant='outlined'
              disabled={mutation.busy}
            >
              Importar usuarios
            </Button>
            <Button variant='contained' disabled={mutation.busy} onClick={() => open({ type: 'create' })}>
              Crear usuario
            </Button>
          </Stack>
        )}
      </Stack>
      {!canReadRoles && (
        <Alert severity='info'>
          No tienes permiso para consultar el catálogo de roles. El filtro y la asignación de roles no están
          disponibles.
        </Alert>
      )}
      {canReadRoles && roles.error && (
        <Alert
          severity='warning'
          action={
            <Button disabled={roles.loading || mutation.busy} onClick={roles.reload}>
              Reintentar
            </Button>
          }
        >
          No se pudo cargar el catálogo de roles. {roles.error}
        </Alert>
      )}
      {!dialog && mutation.error && <Alert severity='error'>{mutation.error}</Alert>}
      {mutation.busy && <LinearProgress aria-label='Guardando cambios' />}
      <DataTableSurface variant='outlined' sx={{ overflow: 'hidden', borderRadius: 2 }}>
        <TableToolbar onRefresh={users.reload} refreshDisabled={users.loading || mutation.busy}>
          <TextField
            size='small'
            label='Buscar nombre, username, CI o RU'
            value={users.query.search}
            onChange={(event) => users.changeQuery({ search: event.target.value })}
            disabled={mutation.busy}
            sx={{ flex: 1 }}
          />
          <TextField
            select
            size='small'
            label='Estado'
            value={users.query.status}
            onChange={(event) => users.changeQuery({ status: event.target.value as RecordStatus })}
            disabled={mutation.busy}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value='all'>Todos</MenuItem>
            <MenuItem value='active'>Activos</MenuItem>
            <MenuItem value='inactive'>Inactivos</MenuItem>
          </TextField>
          {canReadRoles && (
            <TextField
              select
              size='small'
              label='Rol'
              value={users.query.role}
              onChange={(event) => users.changeQuery({ role: event.target.value })}
              disabled={mutation.busy || roles.loading || !!roles.error}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value=''>Todos los roles</MenuItem>
              {roles.roles.map((role) => (
                <MenuItem key={role.idRole} value={role.name}>
                  {role.name}
                  {role.isActive ? '' : ' (inactivo)'}
                </MenuItem>
              ))}
            </TextField>
          )}
        </TableToolbar>
        {users.loading ? (
          <Box sx={{ p: 3 }} role='status' aria-label='Cargando usuarios'>
            <LoadingTable />
          </Box>
        ) : users.error ? (
          <Alert
            severity='error'
            sx={{ m: 3 }}
            action={
              <Button disabled={mutation.busy} onClick={users.reload}>
                Reintentar
              </Button>
            }
          >
            No se pudieron cargar los usuarios. {users.error}
          </Alert>
        ) : (
          <>
            <DataTableContainer>
              <Table aria-label='Usuarios' sx={{ minWidth: 950 }}>
                {/* The backend fixes ordering by idUser; do not offer local sorting of a remote page. */}
                <TableHead>
                  <TableRow>
                    {['Nombre / username', 'CI / RU', 'Email', 'Roles', 'Estado', 'Acciones'].map((label) => (
                      <TableCell key={label}>{label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.rows.map((user) => (
                    <UserRow
                      key={user.idUser}
                      user={user}
                      busy={mutation.busy}
                      onView={() => open({ type: 'detail', user })}
                      onEdit={can('update') ? () => open({ type: 'edit', user }) : undefined}
                      onResetPassword={canReset(user) ? () => open({ type: 'reset', user }) : undefined}
                      onDeactivate={can('delete') ? () => void changeState(user) : undefined}
                      onReactivate={can('reactivate') ? () => void changeState(user) : undefined}
                      onAddRoles={can('assign-roles') && canReadRoles ? () => open({ type: 'roles', user }) : undefined}
                    />
                  ))}
                  {!users.rows.length && (
                    <TableRow>
                      <TableCell colSpan={6} align='center' sx={{ py: 6 }}>
                        <Typography>
                          {hasFilters
                            ? 'No hay usuarios que coincidan con los filtros.'
                            : 'Todavía no hay usuarios registrados.'}
                        </Typography>
                        {hasFilters && (
                          <Button onClick={() => users.changeQuery({ search: '', status: 'all', role: '' })}>
                            Limpiar filtros
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </DataTableContainer>
            <PaginationTable
              count={users.meta.total}
              page={users.meta.page - 1}
              rowsPerPage={users.meta.limit}
              onPageChange={(_, page) => {
                if (!mutation.busy) users.changeQuery({ page: page + 1 });
              }}
              onRowsPerPageChange={(event) => {
                if (!mutation.busy) users.changeQuery({ limit: Number(event.target.value) });
              }}
            />
          </>
        )}
      </DataTableSurface>
      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <UserEditDialog
          user={dialog.type === 'edit' ? dialog.user : null}
          busy={mutation.busy}
          error={mutation.error}
          roles={roles.roles}
          rolesLoading={roles.loading}
          rolesError={roles.error}
          canReadRoles={canReadRoles}
          reloadRoles={roles.reload}
          onClose={close}
          onCreate={create}
          onUpdate={update}
        />
      )}
      {dialog?.type === 'reset' && (
        <Dialog open fullWidth maxWidth='xs' onClose={close} aria-labelledby='user-password-reset-title'>
          <DialogTitle id='user-password-reset-title'>Restablecer contraseña</DialogTitle>
          <DialogContent>
            <Typography fontWeight={600}>
              {dialog.user.name} {dialog.user.lastname}
            </Typography>
            <DialogContentText sx={{ mt: 2 }}>
              Se enviará un código de recuperación al correo electrónico registrado del usuario para que pueda
              establecer una nueva contraseña.
            </DialogContentText>
            {mutation.error && (
              <Alert severity='error' sx={{ mt: 2 }}>
                {mutation.error}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button onClick={close} disabled={mutation.busy}>
              Cancelar
            </Button>
            <Button
              variant='contained'
              disabled={mutation.busy || !canReset(dialog.user)}
              startIcon={
                mutation.busy ? <CircularProgress size={16} color='inherit' aria-label='Enviando' /> : undefined
              }
              onClick={() =>
                void mutation.run(
                  () => requestUserPasswordReset(dialog.user.idUser),
                  'Se inició el proceso de recuperación de contraseña.',
                  () => onSaved(),
                )
              }
            >
              Restablecer contraseña
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {dialog?.type === 'detail' && (
        <UserDetailsDialog user={dialog.user} canFetch={can('get-one-by-id')} onClose={close} />
      )}
      {dialog?.type === 'roles' && (
        <UserRolesDialog
          user={dialog.user}
          roles={roles.roles}
          loading={roles.loading}
          loadError={roles.error}
          reload={roles.reload}
          busy={mutation.busy}
          error={mutation.error}
          onClose={close}
          onAdd={addRoles}
        />
      )}
    </Stack>
  );
}
