'use client';

import * as React from 'react';

import { Box, Button, Paper, Table, TableBody, TableContainer } from '@mui/material';

import AddIcon from '@mui/icons-material/Add';

import type { IRole, IRoleCreate } from '@/interfaces/roles/role.interface';

import { roleHeadCellsData } from './data/head-cells.data';

import { EnhancedTableHead, PaginationTable } from '@/components/table';
import { LoadingTable } from '@/components/skeletons/table/LoadingTable';

import { useDialog } from '@/hooks/useDialog';
import { useDataTable } from '@/hooks/table';

import { useRoles, useRoleMutations } from '@/hooks/roles';
import { usePermissions } from '@/hooks/permissions';

import { RoleRow } from './components/RoleRow';
import { RoleEditDialog } from './components/RoleEditDialog';

export const RolesTable = () => {
  const dialog = useDialog();

  const { roles, loading, load: loadRoles } = useRoles();

  const { permissions, loading: loadingPermissions } = usePermissions();

  const {
    loading: loadingMutation,
    create,
    update,
    remove,
    restore,
  } = useRoleMutations({
    reload: loadRoles,
  });

  const [openDialog, setOpenDialog] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<IRole | null>(null);

  const {
    order,
    orderBy,
    page,
    rowsPerPage,
    visibleRows,
    handleRequestSort,
    handleChangePage,
    handleChangeRowsPerPage,
  } = useDataTable<IRole, typeof roleHeadCellsData>(roles, 'name');

  if (loading) {
    return <LoadingTable />;
  }

  const handleOpenCreate = () => {
    setEditingRole(null);
    setOpenDialog(true);
  };

  const handleOpenEdit = (role: IRole) => {
    setEditingRole(role);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    if (loadingMutation) {
      return;
    }

    setOpenDialog(false);
    setEditingRole(null);
  };

  const handleSubmit = async (data: IRoleCreate) => {
    try {
      let successMessage: string;

      if (editingRole) {
        await update(editingRole.idRole, data);

        successMessage = 'Rol actualizado con éxito';
      } else {
        await create(data);

        successMessage = 'Rol creado con éxito';
      }

      setOpenDialog(false);
      setEditingRole(null);

      await dialog.success(successMessage);
    } catch (error) {
      await dialog.error(editingRole ? 'No se pudo actualizar el rol' : 'No se pudo crear el rol');

      throw error;
    }
  };

  const handleDelete = async (role: IRole) => {
    const confirmed = await dialog.confirm({
      title: `Desactivando "${role.name}"`,
      text: '¿Estás seguro?',
    });

    if (!confirmed) {
      return;
    }

    try {
      await remove(role.idRole);

      await dialog.success('Rol desactivado con éxito');
    } catch (error) {
      await dialog.error('No se pudo desactivar el rol');

      throw error;
    }
  };

  const handleRestore = async (role: IRole) => {
    const confirmed = await dialog.confirm({
      title: `Restaurando "${role.name}"`,
      text: '¿Estás seguro?',
    });

    if (!confirmed) {
      return;
    }

    try {
      await restore(role.idRole);

      await dialog.success('Rol restaurado con éxito');
    } catch (error) {
      await dialog.error('No se pudo restaurar el rol');

      throw error;
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}
    >
      <Button variant='contained' sx={{ alignSelf: 'flex-end' }} startIcon={<AddIcon />} onClick={handleOpenCreate}>
        Registrar rol
      </Button>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-label='roles-table'>
            <EnhancedTableHead<IRole, typeof roleHeadCellsData>
              headCells={roleHeadCellsData}
              order={order}
              orderBy={orderBy}
              onRequestSort={handleRequestSort}
            />

            <TableBody>
              {visibleRows.map((role) => (
                <RoleRow
                  key={role.idRole}
                  role={role}
                  loadingEdit={loadingMutation}
                  disableEdit={!role.isActive}
                  onEdit={handleOpenEdit}
                  onDelete={handleDelete}
                  onRestore={handleRestore}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <PaginationTable
          count={roles.length}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      <RoleEditDialog
        open={openDialog}
        initialValue={
          editingRole
            ? {
                name: editingRole.name,
                description: editingRole.description ?? '',
                permissionNames: editingRole.permissions?.map((permission) => permission.name) ?? [],
              }
            : undefined
        }
        permissions={permissions}
        loadingPermissions={loadingPermissions}
        loading={loadingMutation}
        onClose={handleCloseDialog}
        onSubmit={handleSubmit}
      />
    </Box>
  );
};
