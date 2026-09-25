'use client';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import Form from '@components/Form';

import type { IRoleCreate } from '@/interfaces/roles/role.interface';
import type { IPermission } from '@/interfaces/permissions/permission.interface';

import { useRoleForm } from '@/hooks/roles/useRoleForms';

import { RoleFields } from './RoleFields';

import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';

interface RoleEditDialogProps {
  open: boolean;
  initialValue?: IRoleCreate;
  permissions: IPermission[];
  loadingPermissions: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (role: IRoleCreate) => Promise<void>;
}

export function RoleEditDialog({
  open,
  initialValue,
  permissions,
  loadingPermissions,
  loading,
  onClose,
  onSubmit,
}: RoleEditDialogProps) {
  const { role, updateField, handlePermissionChange, isValid } = useRoleForm({
    initialValue,
  });

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!role) return;

    await onSubmit(role);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle
        sx={{
          textAlign: 'center',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {initialValue ? 'Editar rol' : 'Registrar rol'}
      </DialogTitle>

      <DialogContent>
        <Form onSubmit={handleSubmit} id='role-form'>
          <RoleFields
            form={role}
            permissions={permissions}
            loadingPermissions={loadingPermissions}
            updateField={updateField}
            handlePermissionChange={handlePermissionChange}
          />
        </Form>
      </DialogContent>

      <DialogActions>
        <Button variant='contained' color='error' onClick={onClose}>
          Cerrar
        </Button>

        <Button
          variant='contained'
          color='info'
          type='submit'
          form='role-form'
          disabled={loading || loadingPermissions || !isValid}
        >
          {initialValue ? 'Editar' : 'Guardar'}
        </Button>

        <LoadingOverlay open={loading} />
      </DialogActions>
    </Dialog>
  );
}
