'use client';

import { useRouter } from 'next/navigation';

import { ArrowBack, Assignment, School } from '@mui/icons-material';

import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Link,
  Stack,
  Typography,
} from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { UserRole } from '@/enums/userRole';

interface EnrollmentDetailProps {
  enrollment: IEnrollment;
}

export function EnrollmentDetail({ enrollment }: EnrollmentDetailProps) {
  const router = useRouter();

  const isAssistant = enrollment.role === UserRole.ASSISTANT;

  const gradeScheme = enrollment.course.gradeScheme;

  const details = gradeScheme?.details ?? [];

  return (
    <Box>
      <Stack spacing={4}>
        <Breadcrumbs>
          <Link component='button' underline='hover' onClick={() => router.push('/dashboard/enrollments')}>
            Mis materias
          </Link>

          <Typography color='text.primary'>{enrollment.course.code}</Typography>
        </Breadcrumbs>

        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Stack direction='row' justifyContent='space-between' alignItems='flex-start' gap={2}>
                <Box>
                  <Typography variant='h3' fontWeight={600}>
                    {enrollment.course.code}
                  </Typography>

                  <Typography variant='h5' color='text.secondary'>
                    {enrollment.course.name}
                  </Typography>
                </Box>

                <Chip label={isAssistant ? 'Auxiliar' : 'Estudiante'} color={isAssistant ? 'secondary' : 'primary'} />
              </Stack>

              <Divider />

              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <School />

                    <Box>
                      <Typography variant='caption' color='text.secondary'>
                        Semestre
                      </Typography>

                      <Typography>
                        {enrollment.semester.period}-{enrollment.semester.year}
                      </Typography>
                    </Box>
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Assignment />

                    <Box>
                      <Typography variant='caption' color='text.secondary'>
                        Grupo
                      </Typography>

                      <Typography>{enrollment.course.group}</Typography>
                    </Box>
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Box>
                    <Typography variant='caption' color='text.secondary'>
                      Rol
                    </Typography>

                    <Typography>{isAssistant ? 'Auxiliar' : 'Estudiante'}</Typography>
                  </Box>
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Box>
                <Typography variant='h5' fontWeight={600}>
                  Esquema de calificaciones
                </Typography>

                <Typography variant='body2' color='text.secondary'>
                  {gradeScheme ? gradeScheme.name : 'Sin esquema de calificaciones'}
                </Typography>
              </Box>

              {details.length === 0 ? (
                <Typography color='text.secondary'>
                  Esta materia todavía no tiene un esquema de calificaciones.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {details
                    .sort((a, b) => a.order - b.order)
                    .map((detail) => (
                      <Stack
                        key={detail.idGradeSchemeDetail}
                        direction='row'
                        justifyContent='space-between'
                        alignItems='center'
                      >
                        <Typography>{detail.gradeItem.name}</Typography>

                        <Chip label={`${detail.percentage}%`} variant='outlined' />
                      </Stack>
                    ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Button startIcon={<ArrowBack />} onClick={() => router.push('/dashboard')}>
          Volver a mis materias
        </Button>
      </Stack>
    </Box>
  );
}
