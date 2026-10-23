'use client';

import { useRouter } from 'next/navigation';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { Mode } from '@core/types';
import Logo from '@components/layout/shared/Logo';

const dashboardHref = '/dashboard';

const NotFound: (props: { mode: Mode }) => JSX.Element = () => {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.replace(dashboardHref);
    }
  };

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
          <Box
            component='img'
            src='/images/illustrations/characters/6.png'
            alt=''
            sx={{ display: 'block', width: '100%', height: 'auto' }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: '14%',
              left: '8%',
              p: { xs: 3, md: 4 },
              borderRadius: 3,
              bgcolor: 'background.paper',
              color: 'primary.main',
              boxShadow: 2,
              transform: 'rotate(-10deg)',
            }}
          >
            <i className='ri-book-open-line' style={{ fontSize: '2rem' }} />
          </Box>
          <Box
            sx={{
              position: 'absolute',
              right: '6%',
              top: '36%',
              p: 3,
              borderRadius: '50%',
              bgcolor: 'background.paper',
              color: 'primary.main',
              boxShadow: 1,
            }}
          >
            <i className='ri-search-line' style={{ fontSize: '1.5rem' }} />
          </Box>
        </Box>
        <Stack
          spacing={4}
          sx={{ alignItems: { xs: 'center', md: 'flex-start' }, textAlign: { xs: 'center', md: 'start' } }}
        >
          <Typography
            component='p'
            color='primary.main'
            sx={{
              fontSize: { xs: '6rem', sm: '8rem', md: '10rem' },
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.05em',
            }}
          >
            404
          </Typography>
          <Typography component='h1' variant='h3' sx={{ fontSize: { xs: '1.75rem', sm: '2rem' } }}>
            Página no encontrada
          </Typography>
          <Typography color='text.secondary' sx={{ maxWidth: 440 }}>
            La página que buscas no existe o puede haber sido movida a otra ubicación.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ pt: 3, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              variant='outlined'
              size='large'
              startIcon={<i className='ri-arrow-left-line' />}
              onClick={handleBack}
            >
              Volver atrás
            </Button>
            <Button
              onClick={() => router.push(dashboardHref)}
              variant='contained'
              size='large'
              startIcon={<i className='ri-dashboard-line' />}
            >
              Ir al panel
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Container>
  );
};

export default NotFound;
