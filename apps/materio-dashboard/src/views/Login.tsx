'use client';

// React Imports
import { useState } from 'react';
import type { FormEvent } from 'react';

// Next Imports
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// MUI Imports
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

// MUI Icons
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

// API
import { login as apiLogin } from '../api/auth.service';

// Type Imports
import type { Mode } from '@core/types';

// Components
import LoginBrandPanel from '@/components/auth/LoginBrandPanel';

// Hooks
import { useSnackbar } from '@/hooks/useSnackbar';

// Utils
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const Login = ({ mode }: { mode: Mode }) => {
  const router = useRouter();
  const snackbar = useSnackbar();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isLoading) return;

    const data = new FormData(e.currentTarget);

    const username = String(data.get('username') ?? '').trim();
    const password = String(data.get('password') ?? '');

    if (!username || !password) {
      snackbar.error('Ingresa tu usuario y contraseña.');

      return;
    }

    try {
      setIsLoading(true);

      await apiLogin({
        username,
        password,
      });

      router.push('/dashboard');
    } catch (error) {
      snackbar.error(getApiErrorMessage(error));
    } finally {
      setIsLoading(false);
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
        position: 'relative',
        overflow: 'hidden',
        px: {
          xs: 2,
          sm: 4,
          lg: 6,
        },
        py: {
          xs: 3,
          md: 5,
        },

        bgcolor: mode === 'dark' ? 'background.default' : '#F5F7FC',

        background:
          mode === 'dark'
            ? undefined
            : `
              radial-gradient(
                circle at 15% 15%,
                rgba(70, 112, 255, 0.10),
                transparent 30%
              ),
              radial-gradient(
                circle at 85% 85%,
                rgba(115, 103, 240, 0.08),
                transparent 28%
              ),
              #F5F7FC
            `,
      }}
    >
      {/* Decoración de fondo */}
      <Box
        sx={{
          position: 'absolute',
          width: 460,
          height: 460,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          opacity: mode === 'dark' ? 0.03 : 0.035,
          top: -220,
          left: -100,
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          opacity: mode === 'dark' ? 0.03 : 0.04,
          bottom: -170,
          right: -60,
          pointerEvents: 'none',
        }}
      />

      {/* Contenedor principal */}
      <Paper
        elevation={0}
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          width: '100%',
          maxWidth: 1280,
          minHeight: {
            xs: 'auto',
            md: 650,
          },
          overflow: 'hidden',
          borderRadius: {
            xs: 3,
            md: 4,
          },
          bgcolor: 'background.paper',
          border: (theme) => `1px solid ${theme.palette.divider}`,
          boxShadow: mode === 'dark' ? '0 24px 70px rgba(0,0,0,0.30)' : '0 24px 70px rgba(24,39,75,0.12)',
        }}
      >
        {/* Panel institucional */}
        <LoginBrandPanel />

        {/* Formulario */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            px: {
              xs: 3,
              sm: 7,
              md: 8,
              lg: 10,
            },
            py: {
              xs: 6,
              md: 8,
            },
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 520,
            }}
          >
            {/* Encabezado */}
            <Box sx={{ mb: 5 }}>
              <Typography
                variant='overline'
                color='primary.main'
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  display: 'block',
                  mb: 1,
                }}
              >
                BIENVENIDO
              </Typography>

              <Typography
                component='h2'
                sx={{
                  fontSize: {
                    xs: '2rem',
                    md: '2.35rem',
                  },
                  fontWeight: 700,
                  lineHeight: 1.2,
                  letterSpacing: '-0.025em',
                  color: 'text.primary',
                  mb: 1.25,
                }}
              >
                Inicia sesión
              </Typography>

              <Typography
                variant='body1'
                color='text.secondary'
                sx={{
                  lineHeight: 1.6,
                }}
              >
                Ingresa tus credenciales para acceder al sistema.
              </Typography>
            </Box>

            {/* Formulario */}
            <Box component='form' noValidate autoComplete='off' onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                {/* Usuario */}
                <TextField
                  autoFocus
                  fullWidth
                  required
                  id='username'
                  name='username'
                  label='Usuario'
                  placeholder='Ingresa tu usuario'
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position='start'>
                        <PersonOutlineRoundedIcon color='action' />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      minHeight: 64,
                    },
                  }}
                />

                {/* Contraseña */}
                <TextField
                  fullWidth
                  required
                  id='password'
                  name='password'
                  label='Contraseña'
                  placeholder='Ingresa tu contraseña'
                  type={showPassword ? 'text' : 'password'}
                  disabled={isLoading}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position='start'>
                        <LockOutlinedIcon color='action' />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton edge='end' type='button' onClick={() => setShowPassword((current) => !current)}>
                          {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      minHeight: 64,
                    },
                  }}
                />

                {/* Opciones */}
                <Stack
                  direction={{
                    xs: 'column',
                    sm: 'row',
                  }}
                  alignItems={{
                    xs: 'flex-start',
                    sm: 'center',
                  }}
                  justifyContent='space-between'
                  spacing={1}
                >
                  <FormControlLabel
                    control={<Checkbox name='remember' disabled={isLoading} />}
                    label='Recuérdame'
                    sx={{
                      m: 0,
                    }}
                  />

                  <Link
                    href='/forgot-password'
                    style={{
                      textDecoration: 'none',
                    }}
                  >
                    <Typography
                      variant='body2'
                      color='primary'
                      sx={{
                        fontWeight: 500,

                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      }}
                    >
                      ¿Olvidaste tu contraseña?
                    </Typography>
                  </Link>
                </Stack>

                {/* Login */}
                <Button
                  fullWidth
                  size='large'
                  variant='contained'
                  type='submit'
                  disabled={isLoading}
                  startIcon={isLoading ? <CircularProgress size={19} color='inherit' /> : <LoginRoundedIcon />}
                  sx={{
                    minHeight: 54,
                    fontWeight: 600,
                    fontSize: '1rem',
                    borderRadius: 2,
                    boxShadow: (theme) => `0 8px 20px ${theme.palette.primary.main}35`,

                    '&:hover': {
                      boxShadow: (theme) => `0 10px 25px ${theme.palette.primary.main}45`,
                    },
                  }}
                >
                  {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Button>

                {/* Separador */}
                <Stack
                  direction='row'
                  alignItems='center'
                  spacing={2}
                  sx={{
                    py: 1,
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      height: '1px',
                      bgcolor: 'divider',
                    }}
                  />

                  <Typography variant='caption' color='text.disabled'>
                    o
                  </Typography>

                  <Box
                    sx={{
                      flex: 1,
                      height: '1px',
                      bgcolor: 'divider',
                    }}
                  />
                </Stack>

                {/* Registro */}
                <Stack direction='row' justifyContent='center' alignItems='center' flexWrap='wrap' spacing={1}>
                  <Typography color='text.secondary'>¿Estás registrado?</Typography>

                  <Link
                    href='/register'
                    style={{
                      textDecoration: 'none',
                    }}
                  >
                    <Stack direction='row' alignItems='center' spacing={0.5}>
                      <Typography
                        color='primary'
                        sx={{
                          fontWeight: 600,

                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        Verifica aquí
                      </Typography>

                      <ArrowForwardRoundedIcon
                        color='primary'
                        sx={{
                          fontSize: 18,
                        }}
                      />
                    </Stack>
                  </Link>
                </Stack>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Login;
