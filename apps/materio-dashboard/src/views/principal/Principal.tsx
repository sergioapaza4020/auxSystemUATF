'use client';

import { useEffect, useState } from 'react';

import { Alert, Box, CircularProgress, Grid, Stack, Typography } from '@mui/material';

import { getMyEnrollments } from '@/api/enrollments.service';

import { useAuth } from '@/hooks/useAuth';
import { useSnackbar } from '@/hooks/useSnackbar';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';

import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

import { UserRole } from '@/enums/userRole';
import { EnrollmentCard } from '@/components/principal/EnrollmentCard';

interface CardSummaryProps {
  title: string;
  value: number;
}

function CardSummary({ title, value }: CardSummaryProps) {
  return (
    <Box
      sx={{
        p: 3,
        borderRadius: 1,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Typography variant='body2' color='text.secondary'>
        {title}
      </Typography>

      <Typography variant='h4' mt={1}>
        {value}
      </Typography>
    </Box>
  );
}

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

  if (loading) {
    return (
      <Box display='flex' justifyContent='center' alignItems='center' minHeight={300}>
        <CircularProgress />
      </Box>
    );
  }

  const studentEnrollments = enrollments.filter((enrollment) => enrollment.role === UserRole.STUDENT);

  const assistantEnrollments = enrollments.filter((enrollment) => enrollment.role === UserRole.ASSISTANT);

  return (
    <Stack spacing={6}>
      <Box>
        <Typography variant='h4'>¡Hola, {user?.username}! 👋</Typography>

        <Typography variant='body1' color='text.secondary' mt={1}>
          Aquí puedes consultar tus materias y tu participación en cada una.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <CardSummary title='Materias como estudiante' value={studentEnrollments.length} />
        </Grid>

        <Grid item xs={12} sm={6}>
          <CardSummary title='Materias como auxiliar' value={assistantEnrollments.length} />
        </Grid>
      </Grid>

      {enrollments.length === 0 ? (
        <Alert severity='info'>No tienes materias matriculadas actualmente.</Alert>
      ) : (
        <Box>
          <Typography variant='h5' mb={3}>
            Mis materias
          </Typography>

          <Grid container spacing={3}>
            {enrollments.map((enrollment) => (
              <Grid item xs={12} sm={6} lg={4} key={enrollment.idEnrollment}>
                <EnrollmentCard enrollment={enrollment} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Stack>
  );
}
