'use client';

import { useParams } from 'next/navigation';

import { CircularProgress, Grid, Typography } from '@mui/material';

import { useEnrollmentGrades } from '@/hooks/grades/useEnrollmentGrades';

import { EnrollmentHeader } from '@/views/admin/enrollments/EnrollmentHeader';
import { GradeSchemeCard } from '@/views/admin/enrollments/GradeSchemeCard';
import { GradesCard } from '@/views/admin/enrollments/GradesCard';
import { useManagedEnrollment } from '@/hooks/enrollments/useManagedEnrollment';
import { useAssistantGradeScheme } from '@/hooks/assistant-grade-schemes/useAssistantGradeScheme';

export default function StudentEnrollmentDetailPage() {
  const params = useParams();

  const studentEnrollmentId = Number(params.studentEnrollmentId);

  const { enrollment, loading: loadingEnrollment } = useManagedEnrollment(studentEnrollmentId);

  const { scheme: assistantGradeScheme, loading: loadingAssistantGradeScheme } = useAssistantGradeScheme(
    enrollment?.course.idCourse ?? null,
  );

  const { grades, loading: loadingGrades, load: reloadGrades } = useEnrollmentGrades(studentEnrollmentId);

  if (loadingEnrollment) {
    return <CircularProgress />;
  }

  if (!enrollment) {
    return <Typography color='error'>No se encontró la matriculación del estudiante.</Typography>;
  }

  if (!loadingAssistantGradeScheme && !assistantGradeScheme) {
    return (
      <>
        <EnrollmentHeader enrollment={enrollment} />

        <Typography color='warning.main' sx={{ mt: 4 }}>
          Todavía no has configurado la evaluación del auxiliar para esta materia.
        </Typography>
      </>
    );
  }

  return (
    <>
      <EnrollmentHeader enrollment={enrollment} />

      <Grid container spacing={4} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <GradeSchemeCard enrollment={enrollment} />
        </Grid>

        <Grid item xs={12} md={6}>
          <GradesCard
            enrollment={enrollment}
            grades={grades}
            loading={loadingGrades || loadingAssistantGradeScheme}
            onGradesChanged={reloadGrades}
            isEditable
            gradeScheme={assistantGradeScheme ?? undefined}
            schemeMultiplier={assistantGradeScheme ? Number(assistantGradeScheme.assistantPercentage) / 100 : 1}
            assistantMode
            assistantPercentage={assistantGradeScheme ? Number(assistantGradeScheme.assistantPercentage) : undefined}
          />
        </Grid>
      </Grid>
    </>
  );
}
