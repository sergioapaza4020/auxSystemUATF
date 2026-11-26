'use client';

import { useId } from 'react';

import { passwordPolicyError, passwordRules } from '@repo/password-policy';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';

export default function PasswordRequirements({ password }: { password: string }) {
  const id = useId();
  const checks = passwordRules.map(({ label, validate }) => ({ label, met: validate(password) }));
  const matched = checks.filter(({ met }) => met).length;
  const error = passwordPolicyError(password);

  return (
    <Box component='section' aria-labelledby={id}>
      <Typography id={id} variant='subtitle2'>
        Requisitos de contraseña
      </Typography>
      <Box component='ul' sx={{ listStyle: 'none', p: 0, my: 1 }}>
        {checks.map(({ label, met }) => (
          <Typography key={label} component='li' variant='body2' color={met ? 'success.main' : 'text.secondary'}>
            {met ? 'Cumplido' : 'Pendiente'} · {label}
          </Typography>
        ))}
      </Box>
      <LinearProgress
        variant='determinate'
        value={matched * 20}
        aria-label='Requisitos de contraseña cumplidos'
        aria-valuetext={`${matched} de 5 requisitos cumplidos`}
      />
      <Typography variant='caption' color='text.secondary'>
        {matched} de 5 requisitos cumplidos
      </Typography>
      {matched === checks.length && error && (
        <Typography variant='body2' color='error.main'>
          {error}
        </Typography>
      )}
    </Box>
  );
}
