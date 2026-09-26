import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

import { UserRole } from '@/enums/userRole';
import { getRoleLabel } from '@/utils/roles/getRoleLabel';

interface EnrollmentHeaderProps {
  enrollment: IEnrollment;
}

export function EnrollmentHeader({ enrollment }: EnrollmentHeaderProps) {
  const isAssistant = enrollment.role === UserRole.ASSISTANT;

  return (
    <Card
      variant='outlined'
      sx={{
        borderRadius: 3,
        borderColor: 'divider',
        boxShadow: 'none',
      }}
    >
      <CardContent
        sx={{
          p: { xs: 2.5, sm: 3 },
          '&:last-child': {
            pb: { xs: 2.5, sm: 3 },
          },
        }}
      >
        <Stack direction='row' alignItems='center' spacing={2.5}>
          <Box
            sx={{
              width: 64,
              height: 64,
              flexShrink: 0,

              display: {
                xs: 'none',
                sm: 'flex',
              },

              alignItems: 'center',
              justifyContent: 'center',

              borderRadius: 2.5,

              bgcolor: 'primary.lighterOpacity',
              color: 'primary.main',
            }}
          >
            <Box
              component='i'
              className='ri-graduation-cap-line'
              sx={{
                fontSize: '2rem',
              }}
            />
          </Box>

          <Box sx={{ minWidth: 0, flexGrow: 1 }}>
            <Stack
              direction={{
                xs: 'column',
                sm: 'row',
              }}
              alignItems={{
                xs: 'flex-start',
                sm: 'center',
              }}
              spacing={1.5}
            >
              <Typography
                variant='h4'
                component='h1'
                sx={{
                  fontWeight: 700,
                  color: 'text.primary',
                }}
              >
                {enrollment.course.code}
              </Typography>
            </Stack>

            <Typography
              variant='h6'
              color='text.secondary'
              sx={{
                mt: 0.25,
                fontWeight: 400,
              }}
            >
              {enrollment.course.name}
            </Typography>

            <Stack direction='row' flexWrap='wrap' alignItems='center' gap={2.5} sx={{ mt: 1.5 }}>
              <Stack direction='row' alignItems='center' spacing={0.75}>
                <Box
                  component='i'
                  className='ri-calendar-line'
                  sx={{
                    color: 'text.secondary',
                  }}
                />

                <Typography variant='body2' color='text.secondary'>
                  Semestre:{' '}
                  <Box
                    component='span'
                    sx={{
                      color: 'text.primary',
                      fontWeight: 600,
                    }}
                  >
                    {enrollment.semester.period}-{enrollment.semester.year}
                  </Box>
                </Typography>
              </Stack>

              <Stack direction='row' alignItems='center' spacing={0.75}>
                <Box
                  component='i'
                  className='ri-group-line'
                  sx={{
                    color: 'text.secondary',
                  }}
                />

                <Typography variant='body2' color='text.secondary'>
                  Grupo:{' '}
                  <Box
                    component='span'
                    sx={{
                      color: 'text.primary',
                      fontWeight: 600,
                    }}
                  >
                    {enrollment.course.group}
                  </Box>
                </Typography>
              </Stack>
            </Stack>
          </Box>

          <Chip
            label={getRoleLabel(enrollment.role)}
            color={isAssistant ? 'secondary' : 'primary'}
            sx={{
              alignSelf: 'flex-start',
              mt: 0.5,
              fontWeight: 600,
            }}
          />
        </Stack>
      </CardContent>
    </Card>
  );
}
