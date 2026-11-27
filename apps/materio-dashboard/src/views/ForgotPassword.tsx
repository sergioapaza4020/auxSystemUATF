'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { useRouter } from 'next/navigation';

import Image from 'next/image';
import NextLink from 'next/link';

import { passwordPolicyError } from '@repo/password-policy';

import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import InputAdornment from '@mui/material/InputAdornment';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBack from '@mui/icons-material/ArrowBack';
import LockOutlined from '@mui/icons-material/LockOutlined';
import MailOutline from '@mui/icons-material/MailOutline';
import SendOutlined from '@mui/icons-material/SendOutlined';

import Form from '@components/Form';
import PasswordRequirements from '@/components/auth/PasswordRequirements';
import { passwordRecovery } from '@/api/password-recovery.service';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

const labels = {
  request: [
    '¿Olvidaste tu contraseña?',
    'Ingresa tu correo electrónico y te enviaremos un código para restablecer tu contraseña.',
    'Enviar código de recuperación',
  ],
  verify: [
    'Verifica tu correo',
    'Si el correo está asociado a una cuenta, recibirás un código de recuperación.',
    'Verificar código',
  ],
  reset: [
    'Crea una nueva contraseña',
    'Elige una contraseña segura para volver a acceder a tu cuenta.',
    'Restablecer contraseña',
  ],
} as const;

type Step = keyof typeof labels;
const deadlineKey = 'uatf.recovery.deadline';

function readDeadline() {
  try {
    return Number(sessionStorage.getItem(deadlineKey)) || 0;
  } catch {
    return 0;
  }
}

function writeDeadline(value: number) {
  try {
    sessionStorage.setItem(deadlineKey, String(value));
  } catch {
    // Server-side limits still apply when browser storage is unavailable.
  }
}

const ForgotPassword = ({ step = 'request' }: { step?: Step }) => {
  const router = useRouter();
  const requestInFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [code, setCode] = useState('');
  const [recoveryId, setRecoveryId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState({ password: false, confirmation: false });
  const [complete, setComplete] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(0);
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  const expired = Boolean(!recoveryId && deadline && now >= deadline + 540_000);
  const [title, description, action] = labels[step];
  const mismatch = Boolean(confirmation && confirmation !== password);

  useEffect(() => {
    if (step !== 'verify') return;
    setRecoveryId(new URLSearchParams(window.location.hash.slice(1)).get('recovery') ?? '');
    setDeadline(readDeadline());
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [step]);

  function validateEmail(input: HTMLInputElement | HTMLTextAreaElement) {
    if (!input.value.trim()) return 'Ingresa tu correo electrónico.';
    if (input.validity.typeMismatch || input.value.trim().length > 254) return 'Ingresa un correo electrónico válido.';

    return '';
  }

  async function perform(operation: Step | 'resend', body: Record<string, string> = {}) {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setError('');

    try {
      const response = await passwordRecovery(operation, body);

      if (operation === 'request' || operation === 'resend') {
        const time = Date.now();
        const nextDeadline = time + (response.retryAfter ?? 60) * 1000;

        writeDeadline(nextDeadline);
        setDeadline(nextDeadline);
        setNow(time);
        setCode('');
        if (operation === 'request') router.push('/forgot-password/verify');
      } else if (operation === 'verify') {
        router.push('/forgot-password/reset');
      } else {
        setPassword('');
        setConfirmation('');
        setComplete(true);
      }
    } catch (failure) {
      setError(getApiErrorMessage(failure));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (step === 'request') {
      const input = event.currentTarget.elements.namedItem('email');

      if (!(input instanceof HTMLInputElement)) return;
      const issue = validateEmail(input);

      setEmailError(issue);

      if (issue) {
        input.focus();

        return;
      }

      void perform('request', { email: input.value.trim() });
    } else if (step === 'verify' && code.length === 6 && !expired) {
      void perform('verify', recoveryId ? { id: recoveryId, code } : { code });
    } else if (step === 'reset' && !passwordPolicyError(password) && confirmation === password) {
      void perform('reset', { password });
    }
  }

  return (
    <Box
      component='main'
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: { xs: 3, sm: 6 },
        py: { xs: 5, sm: 8 },
        bgcolor: 'background.default',
        backgroundImage:
          'radial-gradient(ellipse at top left, var(--mui-palette-primary-lightOpacity), transparent 55%), radial-gradient(ellipse at bottom right, var(--mui-palette-primary-lightOpacity), transparent 55%)',
      }}
    >
      <Card
        aria-labelledby='recovery-title'
        sx={{
          width: '100%',
          maxWidth: 1040,
          p: { xs: 4, sm: 8, lg: 12 },
          borderRadius: 4,
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction='row' alignItems='center' spacing={3} sx={{ mb: { xs: 5, sm: 8 } }}>
          <Box sx={{ display: 'flex', p: 0.5, bgcolor: 'common.white', borderRadius: 1.5 }}>
            <Image src='/images/logos/logo.webp' alt='' width={42} height={42} />
          </Box>
          <Typography variant='h6' fontWeight={700}>
            SIGAD UATF
          </Typography>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
            alignItems: 'center',
            gap: { md: 8, lg: 12 },
          }}
        >
          <Stack spacing={5}>
            <Box>
              <Box
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 58,
                  height: 58,
                  borderRadius: 3,
                  bgcolor: 'var(--mui-palette-primary-lightOpacity)',
                  color: 'primary.main',
                  mb: 4,
                }}
              >
                <LockOutlined fontSize='large' />
              </Box>
              <Typography id='recovery-title' component='h1' variant='h4' fontWeight={700} sx={{ mb: 2 }}>
                {complete ? 'Contraseña restablecida' : title}
              </Typography>
              <Typography color='text.secondary'>
                {complete ? 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.' : description}
              </Typography>
            </Box>
            {!complete && (
              <Stack
                component={Form}
                noValidate
                autoComplete={step === 'request' ? 'off' : undefined}
                spacing={4}
                onSubmit={submit}
                aria-busy={busy}
              >
                {step === 'request' && (
                  <TextField
                    id='recovery-email'
                    name='email'
                    type='email'
                    autoComplete='off'
                    label='Correo electrónico'
                    placeholder='tu.correo@uatf.edu.bo'
                    required
                    fullWidth
                    disabled={busy}
                    error={Boolean(emailError)}
                    helperText={emailError}
                    FormHelperTextProps={{ role: emailError ? 'alert' : undefined }}
                    onChange={() => setEmailError('')}
                    onBlur={({ target }) => setEmailError(validateEmail(target))}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ maxLength: 254 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position='start'>
                          <MailOutline color='action' />
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
                {step === 'verify' && (
                  <>
                    <TextField
                      id='recovery-code'
                      label='Código de seis dígitos'
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder='0 0 0 0 0 0'
                      autoComplete='one-time-code'
                      inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                      onPaste={(event) => {
                        const digits = event.clipboardData.getData('text').replace(/[^0-9]/g, '');

                        if (digits.length === 6) {
                          event.preventDefault();
                          setCode(digits);
                        }
                      }}
                      InputLabelProps={{ shrink: true }}
                      disabled={busy || expired}
                      required
                      fullWidth
                      sx={{ '& input': { letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' } }}
                    />
                    {expired && <Alert severity='info'>El código ha vencido. Solicita uno nuevo.</Alert>}
                  </>
                )}
                {step === 'reset' && (
                  <>
                    {(['password', 'confirmation'] as const).map((field) => {
                      const first = field === 'password';
                      const label = first ? 'Nueva contraseña' : 'Confirmar nueva contraseña';

                      return (
                        <TextField
                          key={field}
                          id={`recovery-${field}`}
                          label={label}
                          value={first ? password : confirmation}
                          onChange={(event) => (first ? setPassword : setConfirmation)(event.target.value)}
                          type={visible[field] ? 'text' : 'password'}
                          autoComplete='new-password'
                          disabled={busy}
                          required
                          fullWidth
                          error={!first && mismatch}
                          helperText={!first && mismatch ? 'Las contraseñas no coinciden.' : undefined}
                          InputProps={{
                            endAdornment: (
                              <InputAdornment position='end'>
                                <IconButton
                                  edge='end'
                                  aria-label={`${visible[field] ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`}
                                  onClick={() => setVisible({ ...visible, [field]: !visible[field] })}
                                >
                                  <i className={visible[field] ? 'ri-eye-off-line' : 'ri-eye-line'} aria-hidden />
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                        />
                      );
                    })}
                    <PasswordRequirements password={password} />
                  </>
                )}
                {error && <Alert severity='error'>{error}</Alert>}
                <Button
                  type='submit'
                  variant='contained'
                  fullWidth
                  disabled={
                    busy ||
                    (step === 'verify' && (code.length !== 6 || expired)) ||
                    (step === 'reset' && (Boolean(passwordPolicyError(password)) || confirmation !== password))
                  }
                  startIcon={
                    busy ? <CircularProgress size={18} color='inherit' aria-label='Procesando' /> : <SendOutlined />
                  }
                  sx={{ minHeight: 48, whiteSpace: 'normal', textTransform: 'none' }}
                >
                  {action}
                </Button>
                {step === 'verify' && !recoveryId && (
                  <Button type='button' disabled={busy || seconds > 0} onClick={() => void perform('resend')}>
                    {seconds > 0 ? `Reenviar código en ${seconds} s` : 'Reenviar código'}
                  </Button>
                )}
                {step !== 'request' && (
                  <NextLink href='/forgot-password' passHref legacyBehavior>
                    <Link>Solicitar un nuevo código</Link>
                  </NextLink>
                )}
              </Stack>
            )}

            <NextLink href='/login' passHref legacyBehavior>
              <Link
                underline='hover'
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  alignSelf: 'center',
                  minHeight: 44,
                  gap: 2,
                  '&:focus-visible': { outline: '2px solid', outlineOffset: 4 },
                }}
              >
                <ArrowBack fontSize='small' />
                {complete ? 'Ir al inicio de sesión' : 'Volver al inicio de sesión'}
              </Link>
            </NextLink>
          </Stack>
          <Box sx={{ display: { xs: 'none', md: 'block' }, width: '100%' }}>
            <Image
              src='/images/pages/password-recovery.svg'
              alt=''
              width={360}
              height={280}
              style={{ width: '100%', height: 'auto' }}
            />
          </Box>
        </Box>
      </Card>
    </Box>
  );
};

export default ForgotPassword;
