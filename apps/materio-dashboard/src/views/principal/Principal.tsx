'use client';

// React Imports
import { useEffect, useState } from 'react';

// MUI Imports
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// API Imports
import { getMyEnrollments } from '@/api/enrollments.service';

// Hooks Imports
import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';

// Type Imports
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

// Utils Imports
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

// Enum Imports
import { UserRole } from '@/enums/userRole';

// Component Imports
import { EnrollmentCard } from '@/components/principal/EnrollmentCard';

export function Principal() {
  const [enrollments, setEnrollments] = useState<IEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const snackbar = useSnackbar();
  const { user } = useAuth();

  useEffect(() => {
    const loadEnrollments = async () => {
      try {
        const data = await getMyEnrollments();

        setEnrollments(data);
      } catch (error) {
        snackbar.error(getApiErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    void loadEnrollments();
  }, [snackbar]);

  const studentEnrollments = enrollments.filter((enrollment) => enrollment.role === UserRole.STUDENT);

  const assistantEnrollments = enrollments.filter((enrollment) => enrollment.role === UserRole.ASSISTANT);

  return (
    <Stack spacing={{ xs: 4, md: 5 }}>
      {/* Banner de bienvenida */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',

          px: {
            xs: 3,
            sm: 4,
            md: 5,
          },

          py: {
            xs: 3.5,
            md: 4.5,
          },

          borderRadius: 4,

          color: 'primary.contrastText',

          background: (theme) => `
            linear-gradient(
              120deg,
              ${theme.palette.primary.dark} 0%,
              ${theme.palette.primary.main} 55%,
              ${theme.palette.primary.light} 100%
            )
          `,

          boxShadow: (theme) => `0 12px 30px ${theme.palette.primary.main}22`,
        }}
      >
        {/* Decoración */}
        <Box
          sx={{
            position: 'absolute',

            width: 260,
            height: 260,

            borderRadius: '50%',

            top: -150,
            right: -60,

            bgcolor: 'rgba(255,255,255,0.08)',

            pointerEvents: 'none',
          }}
        />

        <Box
          sx={{
            position: 'absolute',

            width: 180,
            height: 180,

            borderRadius: '50%',

            bottom: -120,
            right: 200,

            bgcolor: 'rgba(255,255,255,0.05)',

            pointerEvents: 'none',
          }}
        />

        <Stack
          direction={{
            xs: 'column',
            md: 'row',
          }}
          alignItems={{
            xs: 'flex-start',
            md: 'center',
          }}
          justifyContent='space-between'
          spacing={4}
          sx={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          {/* Saludo */}
          <Box sx={{ maxWidth: 620 }}>
            <Typography
              component='h1'
              sx={{
                fontSize: {
                  xs: '1.65rem',
                  sm: '1.9rem',
                  md: '2.1rem',
                },

                lineHeight: 1.25,

                fontWeight: 700,

                letterSpacing: '-0.02em',

                color: 'inherit',
              }}
            >
              ¡Hola, {user?.username ?? 'Usuario'}! 👋
            </Typography>

            <Typography
              sx={{
                mt: 1.25,

                maxWidth: 560,

                fontSize: {
                  xs: '0.9rem',
                  md: '1rem',
                },

                lineHeight: 1.65,

                color: 'rgba(255,255,255,0.82)',
              }}
            >
              Gestiona tus materias y consulta tu participación académica desde un solo lugar.
            </Typography>
          </Box>

          {/* Estadísticas */}
          {!loading && (
            <Stack
              direction='row'
              spacing={1.5}
              sx={{
                width: {
                  xs: '100%',
                  sm: 'auto',
                },
              }}
            >
              <SummaryItem icon='ri-book-open-line' value={studentEnrollments.length} label='Como estudiante' />

              <SummaryItem icon='ri-graduation-cap-line' value={assistantEnrollments.length} label='Como auxiliar' />
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Materias */}
      <Box>
        {/* Cabecera */}
        <Stack direction='row' alignItems='flex-end' justifyContent='space-between' spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography
              variant='h5'
              color='text.primary'
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.015em',
              }}
            >
              Mis materias
            </Typography>

            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
              Materias en las que participas actualmente.
            </Typography>
          </Box>

          {!loading && enrollments.length > 0 && (
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{
                display: {
                  xs: 'none',
                  sm: 'block',
                },
              }}
            >
              {enrollments.length} {enrollments.length === 1 ? 'materia' : 'materias'}
            </Typography>
          )}
        </Stack>

        {/* Loading */}
        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3].map((item) => (
              <Grid item xs={12} sm={6} lg={4} key={item}>
                <Skeleton
                  variant='rounded'
                  height={260}
                  sx={{
                    borderRadius: 3,
                  }}
                />
              </Grid>
            ))}
          </Grid>
        ) : enrollments.length === 0 ? (
          /* Empty state */
          <Alert
            severity='info'
            variant='outlined'
            sx={{
              borderRadius: 3,
              py: 1.5,
            }}
          >
            No tienes materias matriculadas actualmente.
          </Alert>
        ) : (
          /* Materias */
          <Grid container spacing={3}>
            {enrollments.map((enrollment) => (
              <Grid item xs={12} sm={6} lg={4} key={enrollment.idEnrollment}>
                <EnrollmentCard enrollment={enrollment} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Stack>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary Item                                                               */
/* -------------------------------------------------------------------------- */

interface SummaryItemProps {
  icon: string;
  value: number;
  label: string;
}

function SummaryItem({ icon, value, label }: SummaryItemProps) {
  return (
    <Box
      sx={{
        minWidth: {
          xs: 0,
          sm: 155,
        },

        flex: {
          xs: 1,
          sm: 'initial',
        },

        display: 'flex',
        alignItems: 'center',

        gap: 1.5,

        px: {
          xs: 1.5,
          sm: 2,
        },

        py: 1.5,

        borderRadius: 2.5,

        border: '1px solid rgba(255,255,255,0.14)',

        bgcolor: 'rgba(255,255,255,0.10)',

        backdropFilter: 'blur(6px)',
      }}
    >
      <Box
        sx={{
          width: 38,
          height: 38,

          flexShrink: 0,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          borderRadius: 2,

          bgcolor: 'rgba(255,255,255,0.12)',

          '& i': {
            fontSize: '1.25rem',
          },
        }}
      >
        <i className={icon} />
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '1.25rem',
            lineHeight: 1.2,
            fontWeight: 700,
            color: 'inherit',
          }}
        >
          {value}
        </Typography>

        <Typography
          sx={{
            mt: 0.25,

            fontSize: '0.72rem',

            whiteSpace: 'nowrap',

            color: 'rgba(255,255,255,0.72)',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Box>
  );
}
