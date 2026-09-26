'use client';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';

import Logo from '@components/layout/shared/Logo';

const features = [
  {
    label: 'Calificaciones',
    icon: <SchoolOutlinedIcon />,
  },
  {
    label: 'Asistencia',
    icon: <GroupsOutlinedIcon />,
  },
  {
    label: 'Informes',
    icon: <DescriptionOutlinedIcon />,
  },
];

const LoginBrandPanel = () => {
  return (
    <Box
      sx={{
        position: 'relative',
        display: {
          xs: 'none',
          md: 'flex',
        },
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '50%',
        minHeight: 650,
        overflow: 'hidden',
        p: {
          md: 6,
          lg: 8,
        },
        color: 'common.white',

        // Imagen institucional
        backgroundImage: `
          linear-gradient(
            135deg,
            rgba(5, 35, 82, 0.98) 0%,
            rgba(8, 58, 126, 0.93) 48%,
            rgba(11, 70, 145, 0.80) 100%
          ),
          url('/images/pages/uatf-building.jpg')
        `,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Decoración superior */}
      <Box
        sx={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          bgcolor: 'rgba(255, 255, 255, 0.035)',
          top: -180,
          right: -100,
          pointerEvents: 'none',
        }}
      />

      {/* Decoración inferior */}
      <Box
        sx={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          bgcolor: 'rgba(255, 255, 255, 0.04)',
          bottom: -320,
          right: -100,
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,

          // Dependiendo de cómo esté construido tu Logo,
          // quizá debas ajustar estos estilos.
          '& svg': {
            maxWidth: 110,
          },
        }}
      >
        <Logo justLogo logoSize={120} />
      </Box>

      {/* Contenido principal */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 460,
          my: 6,
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 3,
            borderRadius: 5,
            bgcolor: 'common.white',
            mb: 3,
            opacity: 0.9,
          }}
        />

        <Typography
          component='h1'
          sx={{
            fontWeight: 700,
            fontSize: {
              md: '2.25rem',
              lg: '2.65rem',
            },
            lineHeight: 1.12,
            letterSpacing: '-0.02em',
            mb: 3,
            color: 'common.white',
          }}
        >
          Sistema Auxiliares
          <br />
          UATF
        </Typography>

        <Typography
          sx={{
            maxWidth: 430,
            fontSize: '1.05rem',
            lineHeight: 1.7,
            color: 'rgba(255, 255, 255, 0.82)',
          }}
        >
          Gestión académica de calificaciones, asistencia y generación de informes para auxiliares de docencia.
        </Typography>
      </Box>

      {/* Características */}
      <Stack
        direction='row'
        divider={
          <Divider
            orientation='vertical'
            flexItem
            sx={{
              borderColor: 'rgba(255,255,255,0.18)',
            }}
          />
        }
        sx={{
          position: 'relative',
          zIndex: 1,
        }}
      >
        {features.map((feature) => (
          <Stack
            key={feature.label}
            alignItems='center'
            spacing={1}
            sx={{
              flex: 1,
              color: 'rgba(255,255,255,0.92)',

              '& svg': {
                fontSize: 30,
              },
            }}
          >
            {feature.icon}

            <Typography
              variant='body2'
              sx={{
                fontWeight: 600,
                color: 'inherit',
              }}
            >
              {feature.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
};

export default LoginBrandPanel;
