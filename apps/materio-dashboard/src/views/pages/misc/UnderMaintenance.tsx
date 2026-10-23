'use client';

import { useRouter } from 'next/navigation';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { Mode } from '@core/types';
import Logo from '@components/layout/shared/Logo';

const UnderMaintenance: (props: { mode: Mode }) => JSX.Element = () => {
  const router = useRouter();

  return (
    <Container
      maxWidth='lg'
      sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', py: { xs: 6, md: 10 } }}
    >
      <Stack direction='row' alignItems='center' spacing={3}>
        <Logo justLogo logoSize={44} />
        <Box>
          <Typography variant='subtitle1' fontWeight={600} color='text.primary'>
            Sistema Académico
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Auxiliares de Docencia
          </Typography>
        </Box>
      </Stack>
      <Box
        component='main'
        sx={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1.15fr)' },
          alignItems: 'center',
          gap: { xs: 6, md: 12 },
          py: { xs: 8, md: 12 },
        }}
      >
        <Box
          aria-hidden='true'
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: { xs: 260, sm: 340, md: 440 },
            mx: 'auto',
            borderRadius: '50%',
            bgcolor: 'action.hover',
            backgroundImage: 'radial-gradient(circle, var(--mui-palette-primary-lightOpacity), transparent 70%)',
          }}
        >
          <Stack
            spacing={3}
            sx={{
              position: 'absolute',
              top: '8%',
              right: '2%',
              width: '47%',
              p: { xs: 3, md: 5 },
              borderRadius: 3,
              bgcolor: 'background.paper',
              color: 'primary.main',
              boxShadow: 2,
              transform: 'rotate(6deg)',
            }}
          >
            <Stack direction='row' spacing={1}>
              {[0, 1, 2].map((dot) => (
                <Box key={dot} sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'action.disabled' }} />
              ))}
            </Stack>
            <Box
              component='i'
              className='ri-settings-3-line'
              sx={{ fontSize: { xs: 40, md: 64 }, alignSelf: 'center' }}
            />
            <Box sx={{ height: 6, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Box sx={{ width: '65%', height: '100%', borderRadius: 1, bgcolor: 'primary.main' }} />
            </Box>
          </Stack>
          <Box
            component='img'
            src='/images/illustrations/characters/6.png'
            alt=''
            sx={{ position: 'relative', display: 'block', width: '100%', height: 'auto' }}
          />
          <Box
            sx={{
              position: 'absolute',
              left: '6%',
              bottom: '18%',
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              bgcolor: 'background.paper',
              color: 'primary.main',
              boxShadow: 1,
              transform: 'rotate(-8deg)',
            }}
          >
            <Box component='i' className='ri-book-open-line' sx={{ fontSize: { xs: 28, md: 40 } }} />
          </Box>
        </Box>
        <Stack
          spacing={4}
          sx={{ minWidth: 0, alignItems: { xs: 'center', md: 'flex-start' }, textAlign: { xs: 'center', md: 'start' } }}
        >
          <Chip
            label='Mantenimiento programado'
            color='primary'
            variant='outlined'
            icon={<i className='ri-tools-line' aria-hidden='true' />}
            sx={{ maxWidth: '100%', height: 'auto', py: 1, '& .MuiChip-label': { whiteSpace: 'normal' } }}
          />
          <Typography
            component='h1'
            variant='h2'
            sx={{ fontSize: { xs: '2.25rem', sm: '2.75rem', md: '3rem' }, lineHeight: 1.15, fontWeight: 700 }}
          >
            En mantenimiento
          </Typography>
          <Typography component='h2' variant='h5' color='text.primary'>
            Estamos realizando mejoras en este momento
          </Typography>
          <Typography color='text.secondary' sx={{ maxWidth: 480 }}>
            Estamos trabajando para brindarte una mejor experiencia. Algunas funciones pueden no estar disponibles
            temporalmente. Intenta nuevamente en unos minutos.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ pt: 3, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant='contained'
              size='large'
              startIcon={<i className='ri-restart-line' aria-hidden='true' />}
              onClick={() => window.location.reload()}
            >
              Reintentar
            </Button>
            <Button
              variant='outlined'
              size='large'
              startIcon={<i className='ri-home-5-line' aria-hidden='true' />}
              onClick={() => router.push('/dashboard')}
            >
              Volver al inicio
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
};

export default UnderMaintenance;
