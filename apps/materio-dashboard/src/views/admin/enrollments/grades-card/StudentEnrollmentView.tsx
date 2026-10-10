'use client';

import { Alert, Stack } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import { EnrollmentHeader } from '../EnrollmentHeader';
import { GradeSchemeCard } from '../GradeSchemeCard';
import { StudentGradesView } from './StudentGradesView';

export function StudentEnrollmentView({
  enrollment,
  grades,
  loading,
}: {
  enrollment: IEnrollment;
  grades: IGrade[];
  loading: boolean;
}) {
  const scheme = enrollment.course.gradeScheme;

  return (
    <Stack spacing={3}>
      <EnrollmentHeader enrollment={enrollment} />
      {scheme ? (
        <StudentGradesView
          scheme={scheme}
          grades={grades}
          loading={loading}
          schemeMultiplier={1}
          maximumScore={100}
          studentEnrollmentId={enrollment.idEnrollment}
          schemeOverview={<GradeSchemeCard enrollment={enrollment} />}
        />
      ) : (
        <>
          <GradeSchemeCard enrollment={enrollment} />
          <Alert severity='info'>Esta materia todavía no tiene un esquema para mostrar tu rendimiento académico.</Alert>
        </>
      )}
    </Stack>
  );
}
