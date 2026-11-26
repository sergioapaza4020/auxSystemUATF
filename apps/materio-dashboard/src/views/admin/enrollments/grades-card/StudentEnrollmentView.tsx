'use client';

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import { Alert, Box, Stack } from '@mui/material';

import SectionNavigation from '@/components/SectionNavigation';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import { EnrollmentHeader } from '../EnrollmentHeader';
import { GradeSchemeCard } from '../GradeSchemeCard';
import { StudentGradesView } from './StudentGradesView';
import { StudentAttendanceCheckIn } from '@/views/attendance/StudentAttendanceCheckIn';

const sectionIds = {
  attendance: 'enrollment-attendance',
  scheme: 'enrollment-scheme',
  performance: 'enrollment-performance',
  grades: 'enrollment-grades',
};

const sections = [
  {
    id: sectionIds.attendance,
    label: 'Registro de asistencia',
    icon: <i className='ri-calendar-line' aria-hidden />,
  },
  { id: sectionIds.scheme, label: 'Esquema de la materia', icon: <i className='ri-list-check' aria-hidden /> },
  {
    id: sectionIds.performance,
    label: 'Mi rendimiento académico',
    icon: <i className='ri-bar-chart-line' aria-hidden />,
  },
  { id: sectionIds.grades, label: 'Mis calificaciones', icon: <i className='ri-file-list-line' aria-hidden /> },
];

export function StudentEnrollmentView({
  enrollment,
  grades,
  loading,
  gradesFeedback,
}: {
  enrollment: IEnrollment;
  grades: IGrade[];
  loading: boolean;
  gradesFeedback?: ReactNode;
}) {
  const scheme = enrollment.course.gradeScheme;
  const [attendanceRevision, setAttendanceRevision] = useState(0);
  const refreshAttendance = useCallback(() => setAttendanceRevision((value) => value + 1), []);

  const schemeOverview = (
    <Box component='section' id={sectionIds.scheme} aria-label='Esquema de la materia' tabIndex={-1}>
      <GradeSchemeCard enrollment={enrollment} />
    </Box>
  );

  return (
    <Stack spacing={3}>
      <EnrollmentHeader enrollment={enrollment} />
      <SectionNavigation label='Secciones de la matrícula' items={sections} scrollable />
      <Box component='section' id={sectionIds.attendance} aria-label='Registro de asistencia' tabIndex={-1}>
        <StudentAttendanceCheckIn enrollment={enrollment} onAcademicRefresh={refreshAttendance} />
      </Box>
      {scheme ? (
        <StudentGradesView
          scheme={scheme}
          grades={grades}
          loading={loading}
          schemeMultiplier={1}
          maximumScore={100}
          studentEnrollmentId={enrollment.idEnrollment}
          attendanceRevision={attendanceRevision}
          schemeOverview={schemeOverview}
          sectionIds={sectionIds}
          gradesFeedback={gradesFeedback}
        />
      ) : (
        <>
          {schemeOverview}
          <Box component='section' id={sectionIds.performance} aria-label='Mi rendimiento académico' tabIndex={-1}>
            <Alert severity='info'>
              Esta materia todavía no tiene un esquema para mostrar tu rendimiento académico.
            </Alert>
          </Box>
          <Box component='section' id={sectionIds.grades} aria-label='Mis calificaciones' tabIndex={-1}>
            {gradesFeedback ?? (
              <Alert severity='info'>Esta materia todavía no tiene un esquema para mostrar tus calificaciones.</Alert>
            )}
          </Box>
        </>
      )}
    </Stack>
  );
}
