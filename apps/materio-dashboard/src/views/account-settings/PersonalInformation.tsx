'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { requestEmailChange, updateOwnProfile } from '@/api/account-settings.service';
import { watchPendingEmail } from '@/hooks/pending-email-lifecycle';
import { useAuth } from '@/hooks/useAuth';
import type { PendingEmailChange, ProfileFields } from '@/interfaces/auth/account-settings.interface';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const fields = [
  { key: 'name', label: 'Nombres', autoComplete: 'given-name' },
  { key: 'lastname', label: 'Apellidos', autoComplete: 'family-name' },
  { key: 'email', label: 'Correo electrónico', autoComplete: 'email' },
] as const;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export default function PersonalInformation({ user }: { user: ICurrentUser }) {
  const { refreshUser } = useAuth();
  const [draft, setDraft] = useState<Partial<ProfileFields>>({});
  const [confirmed, setConfirmed] = useState<ProfileFields | null>(null);
  const [pendingState, setPendingState] = useState<{ request: PendingEmailChange; sent: boolean } | null>(null);
  const pending = pendingState?.request;
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [errors, setErrors] = useState<Partial<ProfileFields>>({});
  const [failure, setFailure] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);

  useLayoutEffect(() => () => request.current?.abort(), []);
  useLayoutEffect(() => setConfirmed(null), [user.name, user.lastname, user.email]);
  const lifecycle = useRef<ReturnType<typeof watchPendingEmail> | null>(null);
  const resendFrom = useRef<PendingEmailChange>();

  useEffect(() => {
    setPendingState(null);

    const watcher = watchPendingEmail(user.idSession, (result, sent) => {
      if (!result || normalizeEmail(result.newEmail) === normalizeEmail(user.email)) {
        setPendingState(null);

        return;
      }

      setPendingState((previous) =>
        !sent && previous?.request.newEmail === result.newEmail && previous.request.expiresAt === result.expiresAt
          ? previous
          : { request: result, sent },
      );
    });

    lifecycle.current = watcher;

    return () => {
      watcher.dispose();
      lifecycle.current = null;
    };
  }, [user.email, user.idSession]);

  useLayoutEffect(() => {
    const resend = resendFrom.current;

    if (!resend || (pending?.newEmail === resend.newEmail && pending.expiresAt === resend.expiresAt)) return;
    resendFrom.current = undefined;
    setDraft(({ name, lastname }) => ({
      ...(name !== undefined && { name }),
      ...(lastname !== undefined && { lastname }),
    }));
    setErrors(({ name, lastname }) => ({ name, lastname }));
    setPassword('');
    setPasswordError(false);
  }, [pending]);

  const baseline = confirmed ?? { name: user.name, lastname: user.lastname ?? '', email: user.email };
  const values = { ...baseline, ...draft };
  const email = normalizeEmail(values.email);
  const changes: Partial<Omit<ProfileFields, 'email'>> = {};
  const changingEmail = email !== normalizeEmail(baseline.email);

  if (values.name.trim() !== baseline.name.trim()) changes.name = values.name.trim();
  if (values.lastname.trim() !== baseline.lastname.trim()) changes.lastname = values.lastname.trim();
  const savingNames = Object.keys(changes).length > 0;
  const dirty = savingNames || changingEmail;

  function cancel() {
    resendFrom.current = undefined;
    setDraft({});
    setPassword('');
    setPasswordError(false);
    setErrors({});
    setFailure('');
    setSaved(false);
    setPendingState((previous) => previous && { ...previous, sent: false });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || request.current) return;

    const validation: Partial<ProfileFields> = {};

    if (!values.name.trim()) validation.name = 'Ingresa tus nombres.';
    if (!values.lastname.trim()) validation.lastname = 'Ingresa tus apellidos.';

    if (changingEmail && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email))) {
      validation.email = 'Ingresa un correo electrónico válido de hasta 254 caracteres.';
    }

    setErrors(validation);
    setFailure('');
    setSaved(false);
    setPendingState((previous) => previous && { ...previous, sent: false });
    setPasswordError(changingEmail && !password);
    if (Object.keys(validation).length > 0 || (changingEmail && !password)) return;

    const controller = new AbortController();

    request.current = controller;
    setBusy(true);

    let namesSaved = false;

    try {
      if (savingNames) {
        const result = await updateOwnProfile(user.idSession, changes, controller.signal);

        if (controller.signal.aborted) return;
        namesSaved = true;
        setConfirmed(result);
        setDraft(changingEmail ? { email } : {});
        setSaved(true);
      }

      if (changingEmail) {
        const watcher = lifecycle.current;

        watcher?.beginSubmission();

        try {
          const result = await requestEmailChange(user.idSession, email, password, controller.signal);

          if (controller.signal.aborted) return;
          resendFrom.current = undefined;
          watcher?.finishSubmission(result);
          setDraft({});
        } catch (error) {
          if (!controller.signal.aborted) watcher?.finishSubmission();
          throw error;
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) setFailure(getApiErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) {
        setPassword('');
        if (namesSaved) await refreshUser();
      }

      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <Stack
      component='form'
      onSubmit={submit}
      noValidate
      spacing={3}
      aria-busy={busy}
      aria-labelledby='personal-information'
    >
      <Typography id='personal-information' component='h3' variant='h6'>
        Información personal
      </Typography>
      <Grid container spacing={3}>
        {fields.map(({ key, label, autoComplete }) => (
          <Grid item xs={12} sm={key === 'email' ? 12 : 6} key={key}>
            <TextField
              id={`profile-${key}`}
              fullWidth
              required
              size='small'
              label={label}
              type={key === 'email' ? 'email' : 'text'}
              autoComplete={autoComplete}
              value={values[key]}
              disabled={busy}
              error={Boolean(errors[key])}
              helperText={
                errors[key] ??
                (key === 'email' && changingEmail && email !== pending?.newEmail
                  ? 'Te enviaremos un enlace para confirmar la nueva dirección.'
                  : undefined)
              }
              onChange={(event) => {
                if (key === 'email') resendFrom.current = undefined;
                setDraft({ ...draft, [key]: event.target.value });
                setErrors({ ...errors, [key]: undefined });
                setFailure('');
                setSaved(false);
              }}
            />
          </Grid>
        ))}
      </Grid>
      {changingEmail && (
        <TextField
          label='Contraseña actual'
          type='password'
          size='small'
          autoComplete='current-password'
          value={password}
          disabled={busy}
          error={passwordError}
          helperText={
            passwordError
              ? 'Ingresa tu contraseña actual.'
              : 'Confirma tu identidad para solicitar el cambio de correo.'
          }
          onChange={(event) => {
            setPassword(event.target.value);
            setPasswordError(false);
          }}
        />
      )}
      {busy && <LinearProgress aria-label='Guardando perfil' />}
      {failure && <Alert severity='error'>{failure}</Alert>}
      {saved && <Alert severity='success'>Tu información personal se guardó.</Alert>}
      {pendingState?.sent && <Alert severity='success'>Te enviamos un enlace para confirmar tu nuevo correo.</Alert>}
      {pending && (
        <Alert
          severity='info'
          sx={{ overflowWrap: 'anywhere' }}
          action={
            <Button
              size='small'
              color='inherit'
              disabled={busy}
              onClick={() => {
                resendFrom.current = pending;
                setDraft({ ...draft, email: pending.newEmail });
                setPassword('');
              }}
            >
              Reenviar
            </Button>
          }
        >
          Pendiente de verificación: {pending.newEmail}. El enlace vence a las{' '}
          {new Intl.DateTimeFormat('es-BO', { timeStyle: 'short', timeZone: 'America/La_Paz' }).format(
            new Date(pending.expiresAt),
          )}
          .
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button type='submit' variant='contained' disabled={!dirty || busy}>
          Guardar cambios
        </Button>
        <Button onClick={cancel} disabled={Object.keys(draft).length === 0 || busy}>
          Cancelar
        </Button>
      </Stack>
    </Stack>
  );
}
