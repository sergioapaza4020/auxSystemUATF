'use client';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { weightedScore, isAttendanceCriterion, criterionScore, totalScore } from '@repo/grade-calculations';
import { Alert, Box, Card, CardContent, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';

import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';
import { getMyStudentAttendance } from '@/api/attendances.service';
import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';
import { calculateActivitiesAverage } from '@/utils/activities-average';
import { GradeViewToggle, DEFAULT_GRADE_DISPLAY_MODE, type GradeDisplayMode } from '../GradeViewToggle';
import { StudentGradeCell } from '../StudentGradeCell';
import { AcademicCriteria, academicSurfaceStyles } from '../student-record/AcademicCriteria';

interface StudentGradesViewProps {
  scheme: IGradeScheme;
  grades: IGrade[];
  loading: boolean;
  schemeMultiplier: number;
  maximumScore: number;
  attendance?: IStudentAttendance | null;
  attendanceLoading?: boolean;
  studentEnrollmentId?: number;
  schemeOverview?: ReactNode;
}

export function StudentGradesView({
  scheme,
  grades,
  loading,
  schemeMultiplier,
  maximumScore,
  attendance,
  attendanceLoading = false,
  studentEnrollmentId,
  schemeOverview,
}: StudentGradesViewProps) {
  const [mode, setMode] = useState<GradeDisplayMode>(DEFAULT_GRADE_DISPLAY_MODE);
  const [ownAttendance, setOwnAttendance] = useState<IStudentAttendance | null>(null);
  const [loadingOwnAttendance, setLoadingOwnAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const hasAttendance = scheme.details.some((detail) => isAttendanceCriterion(detail.gradeItem.name));

  useEffect(() => {
    let active = true;

    setOwnAttendance(null);
    setAttendanceError(null);

    if (!studentEnrollmentId || !hasAttendance) {
      setLoadingOwnAttendance(false);

      return;
    }

    setLoadingOwnAttendance(true);
    void getMyStudentAttendance(studentEnrollmentId)
      .then((data) => {
        if (active) setOwnAttendance(data);
      })
      .catch((error: unknown) => {
        if (active) setAttendanceError(getApiErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingOwnAttendance(false);
      });

    return () => {
      active = false;
    };
  }, [studentEnrollmentId, hasAttendance]);
  const attendanceSummary = studentEnrollmentId ? ownAttendance : attendance;
  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  const results = details.map((detail) => {
    const activities = detail.activities.filter((activity) => activity.isActive);

    const directGrade = grades.find(
      (grade) => !grade.activity && grade.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
    );

    const rawScore = criterionScore({
      attendance: isAttendanceCriterion(detail.gradeItem.name)
        ? (attendanceSummary ?? { totalSessions: 0, percentage: 0 })
        : undefined,
      activityCount: activities.length,
      activityScore: calculateActivitiesAverage(detail.activities, grades),
      directScore: directGrade ? Number(directGrade.score) : null,
    });

    return {
      idGradeSchemeDetail: detail.idGradeSchemeDetail,
      rawScore,
      weightedScore: weightedScore(rawScore, Number(detail.percentage), schemeMultiplier),
    };
  });

  const currentScore = weightedScore(
    totalScore(
      results.map((result, index) => ({ score: result.rawScore, percentage: Number(details[index].percentage) })),
    ),
    100,
    schemeMultiplier,
  );

  const maxima = details.map((detail) => ({
    idGradeSchemeDetail: detail.idGradeSchemeDetail,
    maximumScore: weightedScore(100, Number(detail.percentage), schemeMultiplier)!,
  }));

  if (loading || attendanceLoading || loadingOwnAttendance)
    return (
      <Stack spacing={3}>
        {schemeOverview}
        <CircularProgress aria-label='Cargando mi rendimiento académico' />
      </Stack>
    );

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          alignItems: 'start',
          gridTemplateColumns: {
            xs: 'minmax(0,1fr)',
            lg: schemeOverview ? 'minmax(0, 5fr) minmax(0, 7fr)' : 'minmax(0,1fr)',
          },
        }}
      >
        {schemeOverview}
        <Card component='section' aria-label='Mi rendimiento académico' sx={academicSurfaceStyles}>
          <CardContent>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              justifyContent='space-between'
              alignItems={{ sm: 'center' }}
            >
              <Typography variant='h5' fontWeight={600}>
                Mi rendimiento académico
              </Typography>
              <GradeViewToggle
                value={mode}
                onChange={setMode}
                sx={{
                  bgcolor: 'action.hover',
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 0.5,
                  borderRadius: 2,
                  '& .MuiToggleButton-root': {
                    minHeight: 44,
                    px: 2,
                    border: 0,
                    borderRadius: 'inherit',
                    typography: 'body2',
                    fontWeight: 600,
                  },
                  '& .MuiToggleButton-root.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              />
            </Stack>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 3 }}>
              {attendanceError ? 'Resultado parcial · Asistencia no disponible' : 'Resultado actual · Acumulado'}
            </Typography>
            <Box
              sx={(theme) => ({
                '& > .MuiTypography-root': { ...theme.typography.h3, fontWeight: 700, color: 'primary.main' },
              })}
            >
              <StudentGradeCell score={currentScore} maximum={maximumScore} total />
            </Box>
            {currentScore !== null && (
              <LinearProgress
                aria-label='Resultado acumulado'
                variant='determinate'
                value={currentScore}
                sx={{ mt: 2, borderRadius: 1 }}
              />
            )}
            <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 2 }}>
              Las actividades pendientes se muestran como --; su aporte se interpreta según las reglas de la materia.
            </Typography>
          </CardContent>
        </Card>
      </Box>
      <Typography variant='h5'>Mis calificaciones</Typography>
      {!details.length && <Alert severity='info'>El esquema todavía no tiene criterios.</Alert>}
      <AcademicCriteria
        scheme={scheme}
        results={results}
        maxima={maxima}
        grades={grades}
        attendance={attendanceSummary ?? null}
        attendanceError={attendanceError}
        mode={mode}
      />
    </Stack>
  );
}
