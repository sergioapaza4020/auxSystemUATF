'use client';

import { useParams } from 'next/navigation';

import { CircularProgress, Grid, Typography } from '@mui/material';

import { useEnrollmentGrades } from '@/hooks/grades/useEnrollmentGrades';

import { EnrollmentHeader } from '@/views/admin/enrollments/EnrollmentHeader';
import { GradeSchemeCard } from '@/views/admin/enrollments/GradeSchemeCard';
import { GradesCard } from '@/views/admin/enrollments/GradesCard';
import { useManagedEnrollment } from '@/hooks/enrollments/useManagedEnrollment';

export default function StudentEnrollmentDetailPage() {
  const params = useParams();

  const studentEnrollmentId = Number(params.studentEnrollmentId);

  const { enrollment, loading: loadingEnrollment } = useManagedEnrollment(studentEnrollmentId);

  const { grades, loading: loadingGrades } = useEnrollmentGrades(studentEnrollmentId);

  if (loadingEnrollment) {
    return <CircularProgress />;
  }

  if (!enrollment) {
    return <Typography color='error'>No se encontró la matriculación del estudiante.</Typography>;
  }

  return (
    <>
      <EnrollmentHeader enrollment={enrollment} />

      <Grid container spacing={4} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <GradeSchemeCard enrollment={enrollment} />
        </Grid>

        <Grid item xs={12} md={6}>
          <GradesCard enrollment={enrollment} grades={grades} loading={loadingGrades} />
        </Grid>
      </Grid>
    </>
  );
}
