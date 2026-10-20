'use client';

import { useParams } from 'next/navigation';

import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';

import { useEnrollment } from '@/hooks/enrollments/useEnrollment';
import { useEnrollmentGrades } from '@/hooks/grades/useEnrollmentGrades';
import { EnrollmentDetail } from '@/views/admin/enrollments/EnrollmentDetail';
import { UserRole } from '@/enums/userRole';
import { useAssistantGradeScheme } from '@/hooks/assistant-grade-schemes/useAssistantGradeScheme';

export default function EnrollmentDetailPage() {
  const params = useParams();

  const idEnrollment = Number(params.idEnrollment);

  const { enrollment, loading: loadingEnrollment } = useEnrollment(idEnrollment);

  const {
    scheme: assistantGradeScheme,
    load: reloadAssistantGradeScheme,
    loading: loadingAssistantGradeScheme,
    saving: savingAssistantGradeScheme,
    create: createAssistantGradeScheme,
    update: updateAssistantGradeScheme,
  } = useAssistantGradeScheme(
    enrollment?.role === UserRole.ASSISTANT ? enrollment.course.idCourse : null,
    enrollment?.idEnrollment,
  );

  const { grades, loading: loadingGrades, error: gradesError, load: reloadGrades } = useEnrollmentGrades(idEnrollment);

  if (loadingEnrollment) {
    return <CircularProgress />;
  }

  if (!enrollment) {
    return <Typography color='error'>No se encontró la matriculación.</Typography>;
  }

  if (enrollment.role === UserRole.STUDENT && gradesError) {
    return (
      <Stack spacing={2}>
        <Alert severity='error'>{gradesError}</Alert>
        <Button onClick={() => void reloadGrades()}>Reintentar</Button>
      </Stack>
    );
  }

  return (
    <EnrollmentDetail
      enrollment={enrollment}
      grades={grades}
      students={[]}
      loadingGrades={loadingGrades}
      loadingStudents={false}
      assistantGradeScheme={assistantGradeScheme}
      loadingAssistantGradeScheme={loadingAssistantGradeScheme}
      savingAssistantGradeScheme={savingAssistantGradeScheme}
      onActivitiesChanged={reloadAssistantGradeScheme}
      onCreateAssistantGradeScheme={createAssistantGradeScheme}
      onUpdateAssistantGradeScheme={updateAssistantGradeScheme}
    />
  );
}
