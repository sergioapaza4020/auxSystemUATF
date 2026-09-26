'use client';

import { useState } from 'react';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';

import Form from '@/components/Form';
import type { IPermission, IPermissionCreate } from '@/interfaces/permissions/permission.interface';
import { permissionKeyError } from '../permission-rules';

interface Props {
  permission: IPermission | null;
  records: IPermission[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (data: IPermissionCreate) => Promise<void>;
}

export function PermissionEditDialog({ permission, records, busy, error, onClose, onSave }: Props) {
  const [name, setName] = useState(permission?.name ?? '');
  const [description, setDescription] = useState(permission?.description ?? '');
  const keyError = permission ? '' : permissionKeyError(name, records);

  return (
    <Dialog
      open
      fullWidth
      maxWidth='sm'
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby='permission-dialog-title'
    >
      <DialogTitle id='permission-dialog-title'>
        {permission ? 'Editar descripción del permiso' : 'Crear permiso'}
      </DialogTitle>
      <DialogContent>
        <Form
          id='permission-form'
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && !keyError)
              void onSave({ name: permission?.name ?? name.trim(), description: description.trim() });
          }}
        >
          <Stack spacing={3} sx={{ pt: 2 }}>
            {error && <Alert severity='error'>{error}</Alert>}
            <Alert severity='info'>
              {permission
                ? 'La clave es permanente en esta pantalla porque la utilizan los controles de acceso.'
                : 'Crear una clave no habilita nuevas funciones. Su asignación a roles se gestiona desde Roles.'}
            </Alert>
            <TextField
              autoFocus={!permission}
              label='Clave / nombre'
              fullWidth
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={busy}
              InputProps={{ readOnly: !!permission }}
              error={!permission && !!name && !!keyError}
              helperText={!permission && name ? keyError : 'Ejemplo: user.get-all'}
            />
            <TextField
              autoFocus={!!permission}
              label='Descripción'
              fullWidth
              multiline
              minRows={3}
              value={description}
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Stack>
        </Form>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button variant='contained' type='submit' form='permission-form' disabled={busy || !!keyError}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
