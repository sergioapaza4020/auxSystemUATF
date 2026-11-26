'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';

import { removeAvatar, replaceAvatar } from '@/api/avatars.service';
import PrivateAvatar from '@/components/auth/PrivateAvatar';
import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'];

export default function ProfilePhoto({ user }: { user: ICurrentUser }) {
  const { refreshUser } = useAuth();
  const { success } = useSnackbar();
  const picker = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const [selection, setSelection] = useState<File>();
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ previous: string | null; version: string | null }>();
  const originalVersion = user.avatarVersion ?? null;
  const version = saved && saved.previous === originalVersion ? saved.version : originalVersion;

  const initials = [user.name, user.lastname]
    .map((part) => part?.trim().charAt(0) ?? '')
    .join('')
    .toLocaleUpperCase('es-BO');

  useLayoutEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!selection) return;
    const url = URL.createObjectURL(selection);
    const image = new Image();
    let active = true;

    image.src = url;
    void image
      .decode()
      .then(() => {
        if (active) setPreview({ file: selection, url });
      })
      .catch(() => {
        if (!active) return;
        URL.revokeObjectURL(url);
        setError('No pudimos abrir la imagen seleccionada.');
      });

    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [selection]);

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];

    event.target.value = '';
    if (!selected) return;
    setError('');

    if (!acceptedTypes.includes(selected.type) || !selected.size || selected.size > 2 * 1024 * 1024) {
      setError('Selecciona una imagen JPEG, PNG o WebP de hasta 2 MB.');

      return;
    }

    setSelection(selected);
  }

  function close() {
    if (request.current) return;
    setError('');
    setSelection(undefined);
    setPreview(undefined);
    setRemoving(false);
  }

  async function save() {
    if (request.current || (!selection && !removing)) return;
    const controller = new AbortController();

    request.current = controller;
    setBusy(true);
    setError('');

    try {
      const result = selection
        ? await replaceAvatar(user.idSession, selection, controller.signal)
        : await removeAvatar(user.idSession, controller.signal);

      if (controller.signal.aborted) return;
      setSaved({ previous: originalVersion, version: result.avatarVersion });
      setSelection(undefined);
      setPreview(undefined);
      setRemoving(false);
      success(selection ? 'Tu fotografía se guardó.' : 'Tu fotografía se quitó.');
      await refreshUser();
    } catch (failure) {
      if (!controller.signal.aborted) setError(getApiErrorMessage(failure));
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <Stack spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
      <PrivateAvatar
        idUser={user.idUser}
        avatarVersion={version}
        variant='rounded'
        alt='Fotografía de perfil'
        sx={{ width: 96, height: 96, fontSize: '2rem', bgcolor: 'primary.main', color: 'primary.contrastText' }}
      >
        {initials}
      </PrivateAvatar>
      <input ref={picker} type='file' accept={acceptedTypes.join(',')} onChange={choose} hidden />
      <Button size='small' variant='outlined' disabled={busy} onClick={() => picker.current?.click()}>
        Cambiar foto
      </Button>
      {version && (
        <Button
          size='small'
          disabled={busy}
          onClick={() => {
            setError('');
            setRemoving(true);
          }}
          color='error'
        >
          Quitar foto
        </Button>
      )}
      {!selection && !removing && error && <Alert severity='error'>{error}</Alert>}
      <Dialog
        open={Boolean(selection || removing)}
        onClose={close}
        fullWidth
        maxWidth='xs'
        aria-labelledby='avatar-dialog-title'
        aria-describedby={removing ? 'avatar-dialog-description' : undefined}
      >
        <DialogTitle id='avatar-dialog-title'>
          {removing ? 'Quitar fotografía' : 'Vista previa de la fotografía'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {removing ? (
              <DialogContentText id='avatar-dialog-description'>
                Tu perfil volverá a mostrar el avatar predeterminado.
              </DialogContentText>
            ) : (
              <Avatar
                sx={{
                  width: 144,
                  height: 144,
                  alignSelf: 'center',
                  bgcolor: 'background.paper',
                  '& .MuiAvatar-img': { objectFit: 'cover' },
                }}
                src={selection && preview?.file === selection ? preview.url : undefined}
                alt='Vista previa de la fotografía'
              />
            )}
            {busy && <LinearProgress aria-label='Guardando fotografía' />}
            {error && <Alert severity='error'>{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={busy} onClick={close}>
            Cancelar
          </Button>
          <Button
            variant='contained'
            disabled={busy || Boolean(selection && preview?.file !== selection)}
            onClick={() => void save()}
          >
            {removing ? 'Confirmar eliminación' : 'Guardar foto'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
