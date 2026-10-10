'use client';

import { useEffect, useState } from 'react';

import { useParams } from 'next/navigation';

import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';

import { useSnackbar } from '@/hooks/useSnackbar';

import { useEnrollment } from '@/hooks/enrollments/useEnrollment';
import { useEnrollmentGrades } from '@/hooks/grades/useEnrollmentGrades';
import { EnrollmentDetail } from '@/views/admin/enrollments/EnrollmentDetail';
import { getEnrollmentStudents } from '@/api/enrollments.service';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { UserRole } from '@/enums/userRole';
import { useAssistantGradeScheme } from '@/hooks/assistant-grade-schemes/useAssistantGradeScheme';

export default function EnrollmentDetailPage() {
  const [students, setStudents] = useState<IEnrollmentStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

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

  const snackbar = useSnackbar();

  useEffect(() => {
    const loadStudents = async () => {
      if (!enrollment) return;

      if (enrollment.role !== UserRole.ASSISTANT) return;

      setLoadingStudents(true);

      try {
        const data = await getEnrollmentStudents(enrollment.idEnrollment);

        setStudents(data);
      } catch (error) {
        snackbar.error(getApiErrorMessage(error));
      } finally {
        setLoadingStudents(false);
      }
    };

    void loadStudents();
  }, [enrollment, snackbar]);

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
      students={students}
      loadingGrades={loadingGrades}
      loadingStudents={loadingStudents}
      assistantGradeScheme={assistantGradeScheme}
      loadingAssistantGradeScheme={loadingAssistantGradeScheme}
      savingAssistantGradeScheme={savingAssistantGradeScheme}
      onActivitiesChanged={reloadAssistantGradeScheme}
      onCreateAssistantGradeScheme={createAssistantGradeScheme}
      onUpdateAssistantGradeScheme={updateAssistantGradeScheme}
    />
  );
}
