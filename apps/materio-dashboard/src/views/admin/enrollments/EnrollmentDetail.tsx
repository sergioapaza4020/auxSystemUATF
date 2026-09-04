'use client';

import { useRouter } from 'next/navigation';

import { Box, Grid } from '@mui/material';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import { UserRole } from '@/enums/userRole';

import { EnrollmentHeader } from './EnrollmentHeader';
import { GradeSchemeCard } from './GradeSchemeCard';
import { GradesCard } from './GradesCard';
import { EnrollmentStudentsCard } from './EnrollmentStudentsCard';

interface EnrollmentDetailProps {
  enrollment: IEnrollment;
  grades: IGrade[];
  students: IEnrollmentStudent[];
  loading: boolean;
  loadingStudents: boolean;
}

export function EnrollmentDetail({ enrollment, grades, students, loading, loadingStudents }: EnrollmentDetailProps) {
  const router = useRouter();

  const isAssistant = enrollment.role === UserRole.ASSISTANT;

  return (
    <Box>
      <EnrollmentHeader enrollment={enrollment} />

      <Grid container spacing={4} sx={{ mt: 1 }}>
        <Grid item xs={12} md={6}>
          <GradeSchemeCard enrollment={enrollment} />
        </Grid>

        <Grid item xs={12} md={6}>
          {isAssistant ? (
            <EnrollmentStudentsCard
              students={students}
              loading={loadingStudents}
              onSelectStudent={(student) => {
                router.push(`/dashboard/enrollments/${enrollment.idEnrollment}/students/${student.idEnrollment}`);
              }}
            />
          ) : (
            <GradesCard enrollment={enrollment} grades={grades} loading={loading} />
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
