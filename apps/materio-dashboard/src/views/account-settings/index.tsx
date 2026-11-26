'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import SectionNavigation from '@/components/SectionNavigation';
import { useAuth } from '@/hooks/useAuth';
import type { ICurrentUser } from '@/interfaces/auth/current-user.interface';

import PasswordSettings from './PasswordSettings';
import PersonalInformation from './PersonalInformation';
import ProfilePhoto from './ProfilePhoto';
import SessionSettings from './SessionSettings';

const sections = [
  { id: 'account-profile-section', label: 'Mi perfil', icon: <i className='ri-user-line' aria-hidden /> },
  {
    id: 'account-security-section',
    label: 'Seguridad de la cuenta',
    icon: <i className='ri-shield-line' aria-hidden />,
  },
];

function Profile({ user }: { user: ICurrentUser }) {
  return (
    <Card component='section' id='account-profile-section' aria-labelledby='account-profile' tabIndex={-1}>
      <CardContent>
        <Typography id='account-profile' component='h2' variant='h5' sx={{ mb: 4 }}>
          Mi perfil
        </Typography>
        <Grid container spacing={4}>
          <Grid item xs={12} md={3}>
            <ProfilePhoto user={user} />
          </Grid>
          <Grid item xs={12} md={9}>
            <Stack spacing={4}>
              <PersonalInformation user={user} />
              <Divider />
              <Typography component='h3' variant='h6'>
                Información de la cuenta
              </Typography>
              <Grid container spacing={3}>
                {[
                  ['Nombre de usuario', user.username],
                  ['Cédula de identidad (CI)', user.ci],
                  ['Registro Universitario (RU)', user.ru],
                ].map(([label, value]) => (
                  <Grid item xs={12} sm={6} key={label}>
                    <Typography variant='body2' color='text.secondary'>
                      {label}
                    </Typography>
                    <Typography fontWeight={500} sx={{ overflowWrap: 'anywhere' }}>
                      {value?.trim() ? value : 'No registrado'}
                    </Typography>
                  </Grid>
                ))}
                <Grid item xs={12} sm={6}>
                  <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                    Roles
                  </Typography>
                  <Stack direction='row' gap={1} flexWrap='wrap'>
                    {user.roles.map((role) => (
                      <Chip key={role} label={role} color='primary' variant='outlined' size='small' />
                    ))}
                    {user.roles.length === 0 && <Typography variant='body2'>Sin roles asignados</Typography>}
                  </Stack>
                </Grid>
              </Grid>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default function AccountSettings() {
  const { user, loading, refreshUser } = useAuth();

  return (
    <Stack spacing={5}>
      <Box>
        <Typography component='h1' variant='h4' sx={{ mb: 1 }}>
          Configuración de cuenta
        </Typography>
        <Typography color='text.secondary'>Administra tu perfil y mantén segura tu cuenta.</Typography>
      </Box>

      {loading && <LinearProgress aria-label='Cargando perfil' />}
      {!loading && !user && (
        <Alert
          severity='error'
          action={
            <Button size='small' onClick={() => void refreshUser()}>
              Reintentar
            </Button>
          }
        >
          No pudimos cargar tu perfil.
        </Alert>
      )}
      {user && (
        <Stack spacing={5} key={`${user.idUser}:${user.idSession}`}>
          <SectionNavigation label='Secciones de configuración de cuenta' items={sections} />
          <Profile user={user} />
          <Card component='section' id='account-security-section' aria-labelledby='account-security' tabIndex={-1}>
            <CardContent>
              <Typography id='account-security' component='h2' variant='h5' sx={{ mb: 3 }}>
                Seguridad de la cuenta
              </Typography>
              <Divider sx={{ mb: 4 }} />
              <Grid container spacing={4}>
                <Grid item xs={12} lg={4}>
                  <PasswordSettings idSession={user.idSession} />
                </Grid>
                <Grid item xs={12} lg={8} sx={{ minWidth: 0 }}>
                  <SessionSettings idSession={user.idSession} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
