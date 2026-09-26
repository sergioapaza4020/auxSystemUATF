import { Box, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';

import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';

import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';

import { GradeSummaryRow } from './GradeSummaryRow';
import { GradesSummary } from './GradesSummary';

interface StudentGradesViewProps {
  scheme: IGradeScheme;
  grades: IGrade[];
  loading: boolean;

  schemeMultiplier: number;
  maximumScore: number;

  attendance?: IStudentAttendance | null;
  attendanceLoading?: boolean;
}

const getGradeItemVisual = (name: string) => {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes('práctica') || normalizedName.includes('practica')) {
    return {
      icon: ScienceOutlinedIcon,
      description: 'Actividades prácticas',
      color: 'success.main',
      backgroundColor: 'success.lighterOpacity',
    };
  }

  if (normalizedName.includes('laboratorio')) {
    return {
      icon: SettingsOutlinedIcon,
      description: 'Trabajo de laboratorio',
      color: 'warning.main',
      backgroundColor: 'warning.lighterOpacity',
    };
  }

  if (normalizedName.includes('examen')) {
    return {
      icon: AssignmentOutlinedIcon,
      description: 'Evaluación final de la materia',
      color: 'error.main',
      backgroundColor: 'error.lighterOpacity',
    };
  }

  if (normalizedName.includes('asistencia')) {
    return {
      icon: EventAvailableOutlinedIcon,
      description: 'Registro de asistencia',
      color: 'info.main',
      backgroundColor: 'info.lighterOpacity',
    };
  }

  return {
    icon: DescriptionOutlinedIcon,
    description: 'Componente de evaluación',
    color: 'primary.main',
    backgroundColor: 'primary.lighterOpacity',
  };
};

export function StudentGradesView({
  scheme,
  grades,
  loading,
  schemeMultiplier,
  maximumScore,
  attendance,
  attendanceLoading = false,
}: StudentGradesViewProps) {
  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  const evaluatedPercentage = details.reduce((sum, detail) => {
    const isAttendance = detail.gradeItem.name.toLowerCase() === 'asistencias';

    if (isAttendance) {
      return attendance ? sum + Number(detail.percentage) : sum;
    }

    if (detail.activities.length === 0) {
      const grade = grades.find(
        (item) => !item.activity && item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
      );

      return grade ? sum + Number(detail.percentage) : sum;
    }

    const activitiesWithGrades = detail.activities.filter((activity) =>
      grades.some((grade) => grade.activity?.idActivity === activity.idActivity),
    );

    return activitiesWithGrades.length === detail.activities.length ? sum + Number(detail.percentage) : sum;
  }, 0);

  const currentScore = details.reduce((sum, detail) => {
    const isAttendance = detail.gradeItem.name.toLowerCase() === 'asistencias';

    /*
     * ASISTENCIA
     */
    if (isAttendance) {
      if (!attendance) {
        return sum;
      }

      const contribution = (Number(attendance.percentage) * Number(detail.percentage) * schemeMultiplier) / 100;

      return sum + contribution;
    }

    /*
     * COMPONENTE DIRECTO
     */
    if (detail.activities.length === 0) {
      const grade = grades.find(
        (item) => !item.activity && item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
      );

      if (!grade) {
        return sum;
      }

      const contribution = (Number(grade.score) * Number(detail.percentage) * schemeMultiplier) / 100;

      return sum + contribution;
    }

    /*
     * COMPONENTE CON ACTIVIDADES
     */
    const activityGrades = detail.activities
      .map((activity) => grades.find((grade) => grade.activity?.idActivity === activity.idActivity))
      .filter((grade): grade is IGrade => grade !== undefined);

    if (activityGrades.length === 0) {
      return sum;
    }

    const average =
      activityGrades.reduce((activitySum, grade) => activitySum + Number(grade.score), 0) / activityGrades.length;

    const contribution = (average * Number(detail.percentage) * schemeMultiplier) / 100;

    return sum + contribution;
  }, 0);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Stack spacing={3}>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: 'primary.lighterOpacity',
                color: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DescriptionOutlinedIcon />
            </Box>

            <Box>
              <Typography variant='h5' fontWeight={700}>
                Mis calificaciones
              </Typography>

              <Typography variant='body2' color='text.secondary'>
                Resumen de tu rendimiento académico en la materia
              </Typography>
            </Box>
          </Stack>

          {loading ? (
            <Stack alignItems='center' justifyContent='center' spacing={2} sx={{ py: 8 }}>
              <CircularProgress size={32} />

              <Typography variant='body2' color='text.secondary'>
                Cargando calificaciones...
              </Typography>
            </Stack>
          ) : (
            <>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: {
                      xs: 'none',
                      md: 'grid',
                    },
                    gridTemplateColumns: 'minmax(260px, 1.4fr) 100px minmax(220px, 1fr) 180px',
                    gap: 3,
                    px: 3,
                    py: 1.5,
                    bgcolor: 'action.hover',
                    borderBottom: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant='caption' fontWeight={700} color='text.secondary'>
                    COMPONENTE
                  </Typography>

                  <Typography variant='caption' fontWeight={700} color='text.secondary'>
                    PESO
                  </Typography>

                  <Typography variant='caption' fontWeight={700} color='text.secondary'>
                    PROGRESO
                  </Typography>

                  <Typography variant='caption' fontWeight={700} color='text.secondary' textAlign='right'>
                    CALIFICACIÓN
                  </Typography>
                </Box>

                {details.map((detail) => {
                  const visual = getGradeItemVisual(detail.gradeItem.name);

                  const isAttendance = detail.gradeItem.name.toLowerCase() === 'asistencias';

                  let score: number | null = null;
                  let description = visual.description;

                  if (isAttendance) {
                    score = attendance?.percentage ?? null;

                    if (attendanceLoading) {
                      description = 'Cargando asistencia...';
                    } else if (attendance) {
                      description = `${attendance.presentSessions} de ${attendance.totalSessions} sesiones presentes`;
                    } else {
                      description = 'Sin registros de asistencia';
                    }
                  } else if (detail.activities.length === 0) {
                    const grade = grades.find(
                      (item) =>
                        !item.activity && item.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
                    );

                    score = grade ? Number(grade.score) : null;
                  } else {
                    const activityGrades = detail.activities
                      .map((activity) => grades.find((grade) => grade.activity?.idActivity === activity.idActivity))
                      .filter((grade): grade is IGrade => grade !== undefined);

                    score =
                      activityGrades.length > 0
                        ? activityGrades.reduce((sum, grade) => sum + Number(grade.score), 0) / activityGrades.length
                        : null;

                    description = `${activityGrades.length} de ${detail.activities.length} actividades calificadas`;
                  }

                  return (
                    <GradeSummaryRow
                      key={detail.idGradeSchemeDetail}
                      name={detail.gradeItem.name}
                      description={description}
                      percentage={Number(detail.percentage)}
                      score={score}
                      icon={visual.icon}
                      iconColor={visual.color}
                      iconBackgroundColor={visual.backgroundColor}
                    />
                  );
                })}
              </Box>

              <GradesSummary
                evaluatedPercentage={evaluatedPercentage}
                currentScore={currentScore}
                maximumScore={maximumScore}
              />
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
