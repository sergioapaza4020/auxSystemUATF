'use client';

import { useCallback, useState } from 'react';

import { Alert, Stack } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import { EnrollmentHeader } from '../EnrollmentHeader';
import { GradeSchemeCard } from '../GradeSchemeCard';
import { StudentGradesView } from './StudentGradesView';
import { StudentAttendanceCheckIn } from '@/views/attendance/StudentAttendanceCheckIn';

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
  const [attendanceRevision, setAttendanceRevision] = useState(0);
  const refreshAttendance = useCallback(() => setAttendanceRevision((value) => value + 1), []);

  return (
    <Stack spacing={3}>
      <EnrollmentHeader enrollment={enrollment} />
      <StudentAttendanceCheckIn enrollment={enrollment} onAcademicRefresh={refreshAttendance} />
      {scheme ? (
        <StudentGradesView
          scheme={scheme}
          grades={grades}
          loading={loading}
          schemeMultiplier={1}
          maximumScore={100}
          studentEnrollmentId={enrollment.idEnrollment}
          attendanceRevision={attendanceRevision}
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
