'use client';

import { Checkbox, FormControlLabel, FormGroup, Stack, TextField, Typography } from '@mui/material';

import type { IRoleCreate } from '@/interfaces/roles/role.interface';
import type { IPermission } from '@/interfaces/permissions/permission.interface';

interface RoleFieldsProps {
  form: IRoleCreate;
  permissions: IPermission[];
  loadingPermissions: boolean;
  updateField: (field: keyof IRoleCreate, value: string | string[]) => void;
  handlePermissionChange: (permissionName: string) => void;
}

export function RoleFields({
  form,
  permissions,
  loadingPermissions,
  updateField,
  handlePermissionChange,
}: RoleFieldsProps) {
  const groupedPermissions = permissions.reduce<Record<string, IPermission[]>>((groups, permission) => {
    const [group] = permission.name.split('.');

    if (!groups[group]) {
      groups[group] = [];
    }

    groups[group].push(permission);

    return groups;
  }, {});

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

      <Stack spacing={1}>
        <Typography variant='h6'>Permisos</Typography>

        {loadingPermissions ? (
          <Typography color='text.secondary'>Cargando permisos...</Typography>
        ) : permissions.length === 0 ? (
          <Typography color='text.secondary'>No hay permisos disponibles.</Typography>
        ) : (
          Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
            <Stack key={group} spacing={0.5}>
              <Typography variant='subtitle1' fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                {group}
              </Typography>

              <FormGroup>
                {groupPermissions.map((permission) => (
                  <FormControlLabel
                    key={permission.idPermission}
                    control={
                      <Checkbox
                        checked={form.permissionNames.includes(permission.name)}
                        onChange={() => handlePermissionChange(permission.name)}
                      />
                    }
                    label={permission.name}
                  />
                ))}
              </FormGroup>
            </Stack>
          ))
        )}
      </Stack>
    </Stack>
  );
}
