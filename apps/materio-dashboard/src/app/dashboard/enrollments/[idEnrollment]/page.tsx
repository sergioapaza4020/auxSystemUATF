'use client';

import { useEffect, useState } from 'react';

import { useParams } from 'next/navigation';

import { CircularProgress, Typography } from '@mui/material';

import { useSnackbar } from '@/hooks/useSnackbar';

import { useEnrollment } from '@/hooks/enrollments/useEnrollment';
import { useEnrollmentGrades } from '@/hooks/grades/useEnrollmentGrades';
import { EnrollmentDetail } from '@/views/admin/enrollments/EnrollmentDetail';
import { getEnrollmentStudents } from '@/api/enrollments.service';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { UserRole } from '@/enums/userRole';

export default function EnrollmentDetailPage() {
  const [students, setStudents] = useState<IEnrollmentStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const params = useParams();

  const idEnrollment = Number(params.idEnrollment);

  const { enrollment, loading: loadingEnrollment } = useEnrollment(idEnrollment);

  const { grades } = useEnrollmentGrades(idEnrollment);

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

  return (
    <EnrollmentDetail
      enrollment={enrollment}
      grades={grades}
      students={students}
      loading={loadingStudents}
      loadingStudents={loadingStudents}
    />
  );
}
