'use client';

import { Stack, TextField, Typography } from '@mui/material';

import type { IRoleCreate } from '@/interfaces/roles/role.interface';
import type { IPermission } from '@/interfaces/permissions/permission.interface';
import { GroupedPermissionSelector } from './GroupedPermissionSelector';

interface RoleFieldsProps {
  form: IRoleCreate;
  permissions: IPermission[];
  loadingPermissions: boolean;
  updateField: (field: keyof IRoleCreate, value: string | string[]) => void;
}

export function RoleFields({ form, permissions, loadingPermissions, updateField }: RoleFieldsProps) {
  return (
    <Stack spacing={3} sx={{ pt: 1 }}>
      <TextField
        fullWidth
        label='Nombre'
        value={form.name}
        onChange={(event) => updateField('name', event.target.value)}
        required
      />
      <TextField
        fullWidth
        label='Descripción'
        value={form.description ?? ''}
        onChange={(event) => updateField('description', event.target.value)}
        multiline
        minRows={2}
      />
      {loadingPermissions ? (
        <Typography color='text.secondary'>Cargando permisos...</Typography>
      ) : permissions.length === 0 ? (
        <Typography color='text.secondary'>No hay permisos disponibles.</Typography>
      ) : (
        <GroupedPermissionSelector
          permissions={permissions}
          selectedPermissionNames={form.permissionNames}
          onChange={(names) => updateField('permissionNames', names)}
        />
      )}
    </Stack>
  );
}
