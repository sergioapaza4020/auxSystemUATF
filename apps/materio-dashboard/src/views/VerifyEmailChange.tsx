'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { confirmEmailChange } from '@/api/account-settings.service';
import { hasAuthSessionCookie } from '@/api/auth.service';
import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

export default function VerifyEmailChange() {
  const { user, refreshUser, logout } = useAuth();
  const { success } = useSnackbar();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const fragment = window.location.hash;
    const value = new URLSearchParams(fragment.slice(1)).get('token');

    if (fragment) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
      setToken(value && /^[a-zA-Z0-9_-]{43}$/.test(value) ? value : null);
    }

    setReady(true);
  }, []);

  useEffect(() => {
    if (!token) return;
    let active = true;

    setChecking(true);
    void hasAuthSessionCookie()
      .then((present) => (present && active ? refreshUser() : undefined))
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [token, refreshUser]);

  useLayoutEffect(() => () => request.current?.abort(), [user?.idUser, user?.idSession]);

  async function confirm() {
    if (!user || !token || request.current) return;
    const controller = new AbortController();

    request.current = controller;
    setBusy(true);
    setError('');

    try {
      await confirmEmailChange(user.idSession, token, controller.signal);
      if (controller.signal.aborted) return;
      setConfirmed(true);
      setToken(null);
      success('Tu correo electrónico se actualizó correctamente. Vuelve a iniciar sesión.');
      await logout();
    } catch (failure) {
      if (!controller.signal.aborted) setError(getApiErrorMessage(failure));
    } finally {
      request.current = null;
      setBusy(false);
    }
  }

  return (
    <Card sx={{ width: 'min(100% - 32px, 480px)', mx: 'auto', my: 6 }}>
      <CardContent>
        <Stack spacing={3}>
          <Typography component='h1' variant='h5'>
            Confirmar correo electrónico
          </Typography>
          {confirmed ? (
            <Alert severity='success'>Tu correo electrónico se actualizó correctamente. Vuelve a iniciar sesión.</Alert>
          ) : !ready || checking ? (
            <Typography role='status'>Cargando verificación…</Typography>
          ) : !token ? (
            <Alert severity='error'>Este enlace ya no está disponible. Solicita uno nuevo.</Alert>
          ) : !user ? (
            <>
              <Typography>Inicia sesión con la cuenta que solicitó el cambio y vuelve a esta pestaña.</Typography>
              <Button href='/login' target='_blank' rel='noopener noreferrer' variant='contained'>
                Abrir inicio de sesión
              </Button>
              <Button
                onClick={() => {
                  setChecking(true);
                  void hasAuthSessionCookie()
                    .then((present) => (present ? refreshUser() : undefined))
                    .finally(() => setChecking(false));
                }}
              >
                Ya inicié sesión
              </Button>
            </>
          ) : (
            <>
              <Typography>Al confirmar la nueva dirección se cerrarán todas tus sesiones.</Typography>
              <Button variant='contained' disabled={busy} onClick={() => void confirm()}>
                {busy ? 'Confirmando…' : 'Confirmar correo'}
              </Button>
            </>
          )}
          {error && <Alert severity='error'>{error}</Alert>}
          <Button href='/dashboard/account-settings'>Volver a Configuración de cuenta</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
