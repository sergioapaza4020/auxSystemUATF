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
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction='row' justifyContent='space-between' alignItems='center'>
            <Box>
              <Typography variant='h4' fontWeight={700}>
                {enrollment.course.code}
              </Typography>

              <Typography variant='h6' color='text.secondary'>
                {enrollment.course.name}
              </Typography>
            </Box>

            <Chip label={getRoleLabel(enrollment.role)} color={isAssistant ? 'secondary' : 'primary'} />
          </Stack>

          <Stack direction='row' spacing={3}>
            <Typography variant='body2'>
              Semestre:{' '}
              <strong>
                {enrollment.semester.period}-{enrollment.semester.year}
              </strong>
            </Typography>

            <Typography variant='body2'>
              Grupo: <strong>{enrollment.course.group}</strong>
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
