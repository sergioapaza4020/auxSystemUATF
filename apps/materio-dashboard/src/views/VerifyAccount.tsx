'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { isAxiosError } from 'axios';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { checkRegistration } from '@/api/auth.service';
import LoginBrandPanel from '@/components/auth/LoginBrandPanel';
import ModeDropdown from '@components/layout/shared/ModeDropdown';
import Link from '@components/Link';
import type { RegistrationCheck } from '@/interfaces/auth/registration-check.interface';

type CheckState = { status: 'IDLE' | 'LOADING' } | RegistrationCheck | { status: 'ERROR'; message: string };

export default function VerifyAccount() {
  const [ru, setRu] = useState('');
  const [state, setState] = useState<CheckState>({ status: 'IDLE' });
  const [requiredError, setRequiredError] = useState(false);
  const submitLocked = useRef(false);
  const loading = state.status === 'LOADING';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLocked.current) return;

    if (!ru.trim()) {
      setRequiredError(true);

      return;
    }

    submitLocked.current = true;
    setState({ status: 'LOADING' });

    try {
      setState(await checkRegistration(ru.trim()));
    } catch (error) {
      setState({
        status: 'ERROR',
        message:
          isAxiosError(error) && error.response?.status === 429
            ? 'Has realizado demasiados intentos. Inténtalo nuevamente más tarde.'
            : 'No pudimos verificar tu registro en este momento. Inténtalo nuevamente.',
      });
    } finally {
      submitLocked.current = false;
    }
  };

  return (
    <Box
      component='main'
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        px: { xs: 2, sm: 4, lg: 6 },
        py: { xs: 3, md: 5 },
      }}
    >
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          display: 'flex',
          width: '100%',
          maxWidth: 1280,
          overflow: 'hidden',
          borderRadius: { xs: 3, md: 4 },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ position: 'absolute', top: 2, right: 2, zIndex: 1 }}>
          <ModeDropdown />
        </Box>
        <LoginBrandPanel />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: { xs: 3, sm: 7, md: 8 },
            py: { xs: 8, md: 10 },
          }}
        >
          <Stack spacing={4} sx={{ width: '100%', maxWidth: 520 }}>
            <Box>
              <Typography component='h1' variant='h4' sx={{ mb: 2 }}>
                Verifica tu cuenta
              </Typography>
              <Typography color='text.secondary'>
                Ingresa tu RU para comprobar si ya tienes una cuenta registrada en el sistema.
              </Typography>
            </Box>
            <Box component='form' noValidate autoComplete='on' onSubmit={handleSubmit} aria-busy={loading}>
              <Stack spacing={3}>
                <TextField
                  autoFocus
                  fullWidth
                  required
                  id='ru'
                  name='ru'
                  label='RU'
                  autoComplete='username'
                  value={ru}
                  disabled={loading}
                  error={requiredError}
                  helperText={requiredError ? 'Ingresa tu RU.' : undefined}
                  onChange={(event) => {
                    setRu(event.target.value);
                    setRequiredError(false);
                    setState({ status: 'IDLE' });
                  }}
                />
                <Button
                  fullWidth
                  size='large'
                  variant='contained'
                  type='submit'
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={19} color='inherit' /> : undefined}
                >
                  {loading ? 'Verificando...' : 'Verificar'}
                </Button>
              </Stack>
            </Box>
            <Box aria-live='polite' aria-atomic='true'>
              {state.status === 'ACTIVE' && (
                <Stack spacing={3}>
                  <Alert severity='success'>
                    <AlertTitle>Tu cuenta ya está registrada.</AlertTitle>Puedes iniciar sesión con tus credenciales.
                  </Alert>
                  <Button component={Link} href='/login' variant='contained'>
                    Iniciar sesión
                  </Button>
                </Stack>
              )}
              {state.status === 'INACTIVE' && (
                <Alert severity='warning'>
                  <AlertTitle>Tu cuenta está registrada, pero actualmente no está habilitada.</AlertTitle>Comunícate con
                  el responsable del sistema si necesitas acceso.
                </Alert>
              )}
              {state.status === 'NOT_FOUND' && (
                <Alert severity='info'>
                  <AlertTitle>No encontramos una cuenta asociada a este RU.</AlertTitle>Si aún no has sido registrado en
                  una materia, tu cuenta será creada cuando el responsable correspondiente realice tu matrícula.
                </Alert>
              )}
              {state.status === 'ERROR' && <Alert severity='error'>{state.message}</Alert>}
            </Box>
            <Button component={Link} href='/login' variant='text'>
              Volver a iniciar sesión
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
