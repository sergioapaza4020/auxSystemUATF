'use client';

// Next Imports
import { useRouter } from 'next/navigation';

// MUI Imports
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

// Type Imports
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

// Enum Imports
import { UserRole } from '@/enums/userRole';

interface EnrollmentCardProps {
  enrollment: IEnrollment;
}

export function EnrollmentCard({ enrollment }: EnrollmentCardProps) {
  const router = useRouter();

  const isAssistant = enrollment.role === UserRole.ASSISTANT;

  const handleClick = () => {
    router.push(`/dashboard/enrollments/${enrollment.idEnrollment}`);
  };

  return (
    <Card
      variant='outlined'
      sx={{
        height: '100%',

        borderRadius: 3,

        borderColor: 'divider',

        bgcolor: 'background.paper',

        boxShadow: 'none',

        overflow: 'hidden',

        transition: (theme) =>
          theme.transitions.create(['transform', 'box-shadow', 'border-color'], {
            duration: theme.transitions.duration.shorter,
          }),

        '&:hover': {
          transform: 'translateY(-3px)',

          borderColor: (theme) => `${theme.palette.primary.main}50`,

          boxShadow: '0 12px 30px rgba(24, 39, 75, 0.08)',
        },
      }}
    >
      <CardActionArea
        onClick={handleClick}
        sx={{
          height: '100%',

          display: 'flex',
          alignItems: 'stretch',
        }}
      >
        <CardContent
          sx={{
            width: '100%',

            p: 3,

            '&:last-child': {
              pb: 3,
            },
          }}
        >
          <Stack
            spacing={2.5}
            sx={{
              height: '100%',
            }}
          >
            {/* Código + rol */}
            <Stack direction='row' justifyContent='space-between' alignItems='flex-start' spacing={2}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',

                  minWidth: 68,
                  height: 34,

                  px: 1.25,

                  borderRadius: 2,

                  bgcolor: 'action.hover',
                }}
              >
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {enrollment.course.code}
                </Typography>
              </Box>

              <Chip
                size='small'
                label={isAssistant ? 'Auxiliar' : 'Estudiante'}
                color={isAssistant ? 'secondary' : 'primary'}
                variant='tonal'
                sx={{
                  fontWeight: 600,
                }}
              />
            </Stack>

            {/* Materia */}
            <Box
              sx={{
                minHeight: 58,
              }}
            >
              <Typography
                component='h3'
                variant='h6'
                color='text.primary'
                sx={{
                  fontWeight: 700,

                  lineHeight: 1.4,

                  letterSpacing: '-0.01em',
                }}
              >
                {enrollment.course.name}
              </Typography>
            </Box>

            {/* Información */}
            <Stack spacing={1.25}>
              <InfoRow
                icon='ri-calendar-line'
                label='Periodo'
                value={`${enrollment.semester.period}-${enrollment.semester.year}`}
              />

              <InfoRow icon='ri-group-line' label='Grupo' value={String(enrollment.course.group)} />
            </Stack>

            <Box sx={{ flexGrow: 1 }} />

            <Divider />

            {/* Acción */}
            <Stack direction='row' alignItems='center' justifyContent='space-between'>
              <Typography
                variant='body2'
                color='primary.main'
                sx={{
                  fontWeight: 600,
                }}
              >
                Ver materia
              </Typography>

              <Box
                sx={{
                  width: 32,
                  height: 32,

                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',

                  borderRadius: '50%',

                  bgcolor: 'action.hover',

                  color: 'primary.main',

                  transition: (theme) =>
                    theme.transitions.create('transform', {
                      duration: theme.transitions.duration.shorter,
                    }),

                  '.MuiCardActionArea-root:hover &': {
                    transform: 'translateX(3px)',
                  },
                }}
              >
                <i className='ri-arrow-right-line' />
              </Box>
            </Stack>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Info Row                                                                   */
/* -------------------------------------------------------------------------- */

interface InfoRowProps {
  icon: string;
  label: string;
  value: string;
}

function InfoRow({ icon, label, value }: InfoRowProps) {
  return (
    <Stack direction='row' alignItems='center' spacing={1.25}>
      <Box
        sx={{
          width: 30,
          height: 30,

          flexShrink: 0,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          borderRadius: 1.5,

          bgcolor: 'action.hover',

          color: 'text.secondary',

          '& i': {
            fontSize: '1rem',
          },
        }}
      >
        <i className={icon} />
      </Box>

      <Typography variant='body2' color='text.secondary'>
        {label}:
      </Typography>

      <Typography
        variant='body2'
        color='text.primary'
        sx={{
          fontWeight: 500,
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
