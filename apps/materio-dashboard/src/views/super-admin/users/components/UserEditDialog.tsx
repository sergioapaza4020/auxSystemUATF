'use client';

import { useState } from 'react';

import {
  Alert,
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import Form from '@/components/Form';
import type { IUser, IUserCreate, IUserUpdate } from '@/interfaces/users/user.interface';
import type { IRole } from '@/interfaces/roles/role.interface';
import { availableUserRoles, initialUserForm, userCreatePayload, userFields, userUpdatePayload } from '../user-form';

interface Props {
  user: IUser | null;
  busy: boolean;
  error: string;
  roles: IRole[];
  rolesLoading: boolean;
  rolesError: string;
  canReadRoles: boolean;
  reloadRoles: () => void;
  onClose: () => void;
  onCreate: (value: IUserCreate) => Promise<void>;
  onUpdate: (value: IUserUpdate) => Promise<void>;
}

const labels = { name: 'Nombre', lastname: 'Apellidos', username: 'Username', email: 'Email', ci: 'CI', ru: 'RU' };

export function UserEditDialog({
  user,
  busy,
  error,
  roles,
  rolesLoading,
  rolesError,
  canReadRoles,
  reloadRoles,
  onClose,
  onCreate,
  onUpdate,
}: Props) {
  const [form, setForm] = useState(() => initialUserForm(user));
  const [selectedRoles, setSelectedRoles] = useState<IRole[]>([]);

  const valid =
    userFields.every((field) => (field === 'ru' && user && !user.ru ? true : !!form[field].trim())) &&
    (!!user || !!form.password);

  const update = user ? userUpdatePayload(form, user) : null;

  return (
    <Dialog
      open
      fullWidth
      maxWidth='md'
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby='user-editor-title'
    >
      <DialogTitle id='user-editor-title'>{user ? `Editar usuario: ${user.username}` : 'Crear usuario'}</DialogTitle>
      <DialogContent>
        <Form
          id='user-editor-form'
          autoComplete='off'
          onSubmit={(event) => {
            event.preventDefault();
            if (busy || !valid) return;
            if (user && update) void onUpdate(update);
            else
              void onCreate(
                userCreatePayload(
                  form,
                  selectedRoles.map((role) => role.name),
                ),
              );
          }}
        >
          <Stack spacing={3} sx={{ pt: 2 }}>
            {error && <Alert severity='error'>{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap='wrap' gap={3}>
              {userFields.map((field) => (
                <TextField
                  key={field}
                  autoFocus={field === 'name'}
                  label={labels[field]}
                  type={field === 'email' ? 'email' : 'text'}
                  required={field !== 'ru' || !user || !!user.ru}
                  value={form[field]}
                  disabled={busy}
                  onChange={(event) => setForm((previous) => ({ ...previous, [field]: event.target.value }))}
                  sx={{ flex: '1 1 260px' }}
                  helperText={
                    field === 'ru' && user && !user.ru
                      ? 'Sin RU registrado. Déjalo vacío para conservarlo así.'
                      : undefined
                  }
                />
              ))}
            </Stack>
            <TextField
              label={user ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}
              type='password'
              autoComplete='new-password'
              required={!user}
              value={form.password}
              disabled={busy}
              onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
              helperText={
                user
                  ? 'Déjala vacía para conservar la contraseña actual. Nunca se recupera ni muestra la anterior.'
                  : 'Se enviará únicamente al crear la cuenta.'
              }
            />
            {!user && (
              <>
                {!canReadRoles ? (
                  <Alert severity='info'>No tienes permiso para consultar roles. El usuario se creará sin roles.</Alert>
                ) : (
                  <>
                    {rolesError && (
                      <Alert
                        severity='warning'
                        action={
                          <Button disabled={busy || rolesLoading} onClick={reloadRoles}>
                            Reintentar
                          </Button>
                        }
                      >
                        No se pudieron cargar roles. Puedes crear la cuenta sin roles. {rolesError}
                      </Alert>
                    )}
                    <Autocomplete
                      multiple
                      options={availableUserRoles(roles)}
                      value={selectedRoles}
                      onChange={(_, value) => setSelectedRoles(value)}
                      getOptionLabel={(role) => role.name}
                      isOptionEqualToValue={(a, b) => a.idRole === b.idRole}
                      disabled={busy || !!rolesError}
                      loading={rolesLoading}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label='Roles iniciales'
                          helperText='Opcional. Solo se muestran roles activos.'
                        />
                      )}
                    />
                  </>
                )}
              </>
            )}
            {user && (
              <Typography color='text.secondary'>
                Los roles se gestionan con la acción «Añadir roles» de la tabla.
              </Typography>
            )}
          </Stack>
        </Form>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          variant='contained'
          type='submit'
          form='user-editor-form'
          disabled={busy || !valid || (!!update && !Object.keys(update).length)}
        >
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
