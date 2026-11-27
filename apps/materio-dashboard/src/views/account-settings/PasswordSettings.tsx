'use client';

import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { passwordPolicyError } from '@repo/password-policy';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import PasswordRequirements from '@/components/auth/PasswordRequirements';

import { changeOwnPassword } from '@/api/account-settings.service';
import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const fields = [
  { key: 'currentPassword', label: 'Contraseña actual', autoComplete: 'current-password' },
  { key: 'newPassword', label: 'Nueva contraseña', autoComplete: 'new-password' },
  { key: 'confirmation', label: 'Confirmar nueva contraseña', autoComplete: 'new-password' },
] as const;

const empty = { currentPassword: '', newPassword: '', confirmation: '' };

export default function PasswordSettings({ idSession }: { idSession: number }) {
  const { logout } = useAuth();
  const { success } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState<Partial<Record<keyof typeof empty, boolean>>>({});
  const [passwords, setPasswords] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  const { currentPassword, newPassword, confirmation } = passwords;
  const policyError = passwordPolicyError(newPassword);
  const samePassword = Boolean(newPassword && newPassword === currentPassword);
  const confirmationMatches = Boolean(confirmation && confirmation === newPassword);
  const currentTooLong = Array.from(currentPassword).length > 1024;
  const canSubmit = Boolean(currentPassword && !currentTooLong && !policyError && !samePassword && confirmationMatches);

  useLayoutEffect(() => () => request.current?.abort(), []);

  function reset() {
    setOpen(false);
    setVisible({});
    setPasswords(empty);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || request.current) return;
    setError('');

    const controller = new AbortController();

    request.current = controller;
    setBusy(true);

    try {
      await changeOwnPassword(idSession, { currentPassword, newPassword }, controller.signal);
      if (controller.signal.aborted) return;
      reset();
      success('Contraseña actualizada. Inicia sesión nuevamente.');
      await logout();
    } catch (failure) {
      if (!controller.signal.aborted) setError(getApiErrorMessage(failure));
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <Stack spacing={2} alignItems='flex-start'>
      <Typography component='h3' variant='h6'>
        Contraseña
      </Typography>
      <Typography variant='body2' color='text.secondary'>
        Al cambiar tu contraseña se cerrarán tus sesiones en todos los dispositivos.
      </Typography>
      <Button
        variant='outlined'
        disabled={busy}
        onClick={() => setOpen(true)}
        startIcon={<i className='ri-lock-line' />}
      >
        Cambiar contraseña
      </Button>
      <Dialog
        open={open}
        onClose={() => !request.current && reset()}
        fullWidth
        maxWidth='sm'
        PaperProps={{ sx: { maxWidth: 500, minWidth: 0, boxSizing: 'border-box' } }}
        aria-labelledby='password-title'
        aria-describedby='password-description'
      >
        <Box
          component='form'
          onSubmit={submit}
          noValidate
          aria-busy={busy}
          sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}
        >
          <DialogTitle id='password-title'>Cambiar contraseña</DialogTitle>
          <DialogContent sx={{ minWidth: 0 }}>
            <Stack spacing={3} sx={{ pt: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
              <Typography id='password-description' variant='body2' color='text.secondary'>
                Elige una contraseña segura para proteger tu cuenta.
              </Typography>
              {busy && <LinearProgress aria-label='Actualizando contraseña' />}
              {error && (
                <Alert severity='error' sx={{ '& .MuiAlert-message': { minWidth: 0 } }}>
                  {error}
                </Alert>
              )}
              {fields.map(({ key, label, autoComplete }, index) => (
                <Fragment key={key}>
                  <TextField
                    id={key}
                    name={key}
                    autoFocus={index === 0}
                    label={label}
                    fullWidth
                    autoComplete={autoComplete}
                    required
                    disabled={busy}
                    value={passwords[key]}
                    type={visible[key] ? 'text' : 'password'}
                    error={
                      (key === 'confirmation' && Boolean(confirmation) && !confirmationMatches) ||
                      (key === 'newPassword' && samePassword) ||
                      (key === 'currentPassword' && currentTooLong)
                    }
                    helperText={
                      key === 'confirmation' && confirmation
                        ? confirmationMatches
                          ? 'Las contraseñas coinciden.'
                          : 'Las contraseñas no coinciden.'
                        : key === 'newPassword' && samePassword
                          ? 'Elige una contraseña diferente de la actual.'
                          : key === 'currentPassword' && currentTooLong
                            ? 'La contraseña actual es demasiado larga.'
                            : undefined
                    }
                    onChange={(event) => {
                      setPasswords({ ...passwords, [key]: event.target.value });
                      setError('');
                    }}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton
                            edge='end'
                            disabled={busy}
                            aria-label={`${visible[key] ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => setVisible({ ...visible, [key]: !visible[key] })}
                          >
                            <i className={visible[key] ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  {key === 'newPassword' && <PasswordRequirements password={newPassword} />}
                </Fragment>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions
            disableSpacing
            sx={{
              flexWrap: 'wrap',
              gap: 2,
              '& .MuiButtonBase-root:not(:first-of-type)': { marginInlineStart: 0 },
              '& .MuiButton-root': { maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' },
            }}
          >
            <Button onClick={reset} disabled={busy}>
              Cancelar
            </Button>
            <Button type='submit' variant='contained' disabled={busy || !canSubmit}>
              Actualizar contraseña
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Stack>
  );
}
