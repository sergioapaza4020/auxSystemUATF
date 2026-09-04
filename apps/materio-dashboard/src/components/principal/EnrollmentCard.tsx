'use client';

import { useRouter } from 'next/navigation';

import { Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
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
      sx={{
        height: '100%',
      }}
    >
      <CardActionArea
        onClick={handleClick}
        sx={{
          height: '100%',
        }}
      >
        <CardContent>
          <Stack spacing={2}>
            <Stack direction='row' justifyContent='space-between' alignItems='flex-start' spacing={2}>
              <Typography variant='h5' fontWeight={600}>
                {enrollment.course.code}
              </Typography>

              <Chip
                size='small'
                label={isAssistant ? 'Auxiliar' : 'Estudiante'}
                color={isAssistant ? 'secondary' : 'primary'}
              />
            </Stack>

            <Typography variant='h6' color='text.primary'>
              {enrollment.course.name}
            </Typography>

            <Typography variant='body2' color='text.secondary'>
              {enrollment.semester.period}-{enrollment.semester.year}
            </Typography>

            <Typography variant='body2' color='text.secondary'>
              Grupo {enrollment.course.group}
            </Typography>

            <Typography variant='caption' color='text.secondary'>
              Ver detalles →
            </Typography>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
