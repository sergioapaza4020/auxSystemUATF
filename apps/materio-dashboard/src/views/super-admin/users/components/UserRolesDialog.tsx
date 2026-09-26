'use client';

import { useState } from 'react';

import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import type { IUser } from '@/interfaces/users/user.interface';
import type { IRole } from '@/interfaces/roles/role.interface';
import { availableUserRoles } from '../user-form';

interface Props {
  user: IUser;
  roles: IRole[];
  loading: boolean;
  loadError: string;
  reload: () => void;
  busy: boolean;
  error: string;
  onClose: () => void;
  onAdd: (roles: string[]) => Promise<void>;
}

export function UserRolesDialog({ user, roles, loading, loadError, reload, busy, error, onClose, onAdd }: Props) {
  const [selected, setSelected] = useState<IRole[]>([]);
  const options = availableUserRoles(roles, user);

  return (
    <Dialog
      open
      fullWidth
      maxWidth='sm'
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby='user-roles-title'
    >
      <DialogTitle id='user-roles-title'>Añadir roles a {user.username}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ pt: 2 }}>
          <Alert severity='info'>
            Esta acción solo añade roles. Los roles actuales se conservan; quitar o reemplazar roles todavía no está
            disponible.
          </Alert>
          <Typography variant='subtitle2'>Roles actuales</Typography>
          <Stack direction='row' flexWrap='wrap' gap={1}>
            {user.roles?.length ? (
              user.roles.map((role) => (
                <Chip key={role.idRole} label={`${role.name}${role.isActive ? '' : ' (inactivo)'}`} size='small' />
              ))
            ) : (
              <Typography>Sin roles</Typography>
            )}
          </Stack>
          {error && <Alert severity='error'>{error}</Alert>}
          {loadError && (
            <Alert
              severity='error'
              action={
                <Button disabled={busy || loading} onClick={reload}>
                  Reintentar
                </Button>
              }
            >
              {loadError}
            </Alert>
          )}
          <Autocomplete
            multiple
            options={options}
            value={selected}
            onChange={(_, value) => setSelected(value)}
            getOptionLabel={(role) => role.name}
            isOptionEqualToValue={(a, b) => a.idRole === b.idRole}
            disabled={busy || loading || !!loadError}
            loading={loading}
            noOptionsText='No hay roles activos pendientes de asignar'
            renderInput={(params) => <TextField {...params} label='Roles que se añadirán' />}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant='contained'
          disabled={busy || loading || !!loadError || !selected.length}
          onClick={() => void onAdd(selected.map((role) => role.name))}
        >
          {busy ? 'Añadiendo…' : 'Añadir roles'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
