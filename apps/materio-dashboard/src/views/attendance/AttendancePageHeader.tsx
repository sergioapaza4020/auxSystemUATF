import { Box, Button, Stack, Typography } from '@mui/material';

import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

interface AttendancePageHeaderProps {
  enrollment: IEnrollment;
  studentCount: number;
  onBack: () => void;
}

export function AttendancePageHeader({ enrollment, studentCount, onBack }: AttendancePageHeaderProps) {
  const semesterLabel = `${enrollment.semester.period}-${enrollment.semester.year}`;

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent='space-between'
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={2}
    >
      <Box>
        <Typography variant='h4' fontWeight={700} sx={{ mb: 1 }}>
          Asistencia
        </Typography>

        <Stack direction='row' spacing={1.5} alignItems='center'>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              bgcolor: 'primary.lighterOpacity',
              color: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MenuBookOutlinedIcon fontSize='small' />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant='body1' fontWeight={600} noWrap>
              {enrollment.course.code} - {enrollment.course.name}
            </Typography>

            <Stack
              direction='row'
              spacing={1}
              alignItems='center'
              divider={
                <Typography variant='body2' color='text.disabled'>
                  ·
                </Typography>
              }
            >
              <Typography variant='body2' color='text.secondary'>
                Gestión {semesterLabel}
              </Typography>

              <Typography variant='body2' color='text.secondary'>
                {studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'}
              </Typography>
            </Stack>
          </Box>
        </Stack>
      </Box>

      <Button
        variant='outlined'
        startIcon={<ArrowBackOutlinedIcon />}
        onClick={onBack}
        sx={{
          alignSelf: {
            xs: 'flex-start',
            sm: 'center',
          },
          flexShrink: 0,
        }}
      >
        Volver a la materia
      </Button>
    </Stack>
  );
}
