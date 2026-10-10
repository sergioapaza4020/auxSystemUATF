'use client';
import { isAttendanceCriterion } from '@repo/grade-calculations';
import { Alert, Box, Button, Card, CardContent, Chip, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import { alpha, type Theme } from '@mui/material/styles';

import type { IGradeScheme } from '@/interfaces/grade-schemes/grade-scheme.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';
import type { GradeDisplayMode } from '../GradeViewToggle';
import { StudentGradeCell } from '../StudentGradeCell';
import { formatGradeDeadline } from '../grade-management/GradePlanTable';

export interface AcademicCriteriaProps {
  scheme: IGradeScheme;
  results: { idGradeSchemeDetail: number; rawScore: number | null; weightedScore: number | null }[];
  maxima: { idGradeSchemeDetail: number; maximumScore: number }[];
  grades: IGrade[];
  attendance: IStudentAttendance | null;
  attendanceError?: string | null;
  attendanceHref?: string;
  mode: GradeDisplayMode;
}
export const academicSurfaceStyles = (theme: Theme) => ({
  border: '1px solid',
  borderColor: theme.palette.divider,
  borderRadius: 2,
  boxShadow: 'none',
});

export function AcademicCriteria({
  scheme,
  results,
  maxima,
  grades,
  attendance,
  attendanceError,
  attendanceHref,
  mode,
}: AcademicCriteriaProps) {
  const details = [...scheme.details].sort((a, b) => a.order - b.order);

  return (
    <Box
      aria-label='Criterios de evaluación'
      sx={{
        display: 'grid',
        gap: 3,
        alignItems: 'start',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          sm: 'repeat(2, minmax(0, 1fr))',
          lg: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
        },
      }}
    >
      {details.map((detail) => {
        const isAttendance = isAttendanceCriterion(detail.gradeItem.name);
        const activities = detail.activities.filter((activity) => activity.isActive);
        const result = results.find((item) => item.idGradeSchemeDetail === detail.idGradeSchemeDetail);
        const criterion = maxima.find((item) => item.idGradeSchemeDetail === detail.idGradeSchemeDetail);

        const directGrade = grades.find(
          (grade) => !grade.activity && grade.gradeSchemeDetail.idGradeSchemeDetail === detail.idGradeSchemeDetail,
        );

        return (
          <Card
            key={detail.idGradeSchemeDetail}
            component='section'
            aria-label={detail.gradeItem.name}
            sx={(theme) => ({ ...academicSurfaceStyles(theme), minWidth: 0 })}
          >
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack
                direction='row'
                spacing={2}
                justifyContent='space-between'
                alignItems='flex-start'
                sx={(theme) => ({
                  mb: 2,
                  mx: -3,
                  mt: -3,
                  px: 3,
                  pt: 3,
                  pb: 2,
                  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.07 : 0.025),
                })}
              >
                <Stack direction='row' spacing={1.5} sx={{ minWidth: 0 }}>
                  <Box
                    sx={(theme) => ({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                      p: 1,
                      borderRadius: 1.5,
                      alignSelf: 'flex-start',
                    })}
                  >
                    {isAttendance ? (
                      <EventAvailableOutlinedIcon fontSize='small' />
                    ) : (
                      <AssignmentOutlinedIcon fontSize='small' />
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant='h6' fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                      {detail.gradeItem.name}
                    </Typography>
                    <Stack direction='row' spacing={1} alignItems='center' useFlexGap flexWrap='wrap' sx={{ mt: 0.5 }}>
                      <Typography variant='caption' color='text.secondary'>
                        {isAttendance
                          ? attendance && attendance.totalSessions > 0
                            ? `${attendance.totalSessions} sesiones`
                            : 'Registro de asistencia'
                          : activities.length
                            ? `${activities.length} ${activities.length === 1 ? 'actividad' : 'actividades'}`
                            : 'Criterio directo · Sin actividades'}
                      </Typography>
                      <Chip
                        size='small'
                        variant='outlined'
                        label={`${detail.percentage}%`}
                        sx={{ color: 'text.secondary', borderColor: 'divider' }}
                      />
                    </Stack>
                  </Box>
                </Stack>
                <Box
                  aria-label={`Resultado de ${detail.gradeItem.name}`}
                  sx={(theme) => ({
                    flexShrink: 0,
                    textAlign: 'right',
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1.5,
                    '& > .MuiTypography-root': { ...theme.typography.h5, fontWeight: 700, color: 'primary.main' },
                  })}
                >
                  <StudentGradeCell
                    score={mode === 'raw' ? result?.rawScore : result?.weightedScore}
                    maximum={mode === 'raw' ? 100 : criterion?.maximumScore}
                    total
                  />
                </Box>
              </Stack>
              <Divider />
              {isAttendance ? (
                <Stack spacing={2} sx={{ pt: 2 }}>
                  {attendanceError ? (
                    <Alert severity='error'>{attendanceError}</Alert>
                  ) : attendance && attendance.totalSessions > 0 ? (
                    <>
                      <Typography variant='h4' fontWeight={700}>
                        {attendance.percentage.toFixed(1)}%
                      </Typography>
                      <LinearProgress
                        aria-label='Porcentaje de asistencia'
                        variant='determinate'
                        value={attendance.percentage}
                        sx={{ borderRadius: 1 }}
                      />
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1 }}>
                        {[
                          { value: attendance.presentSessions, label: 'Presentes', tone: 'success' as const },
                          { value: attendance.excusedSessions, label: 'Permisos', tone: 'warning' as const },
                          {
                            value: attendance.absentSessions,
                            label: attendance.absentSessions === 1 ? 'Ausencia' : 'Ausencias',
                            tone: 'error' as const,
                          },
                          { value: attendance.totalSessions, label: 'Sesiones', tone: null },
                        ].map((stat) => (
                          <Box
                            key={stat.label}
                            sx={(theme) => ({
                              p: 1.5,
                              bgcolor: stat.tone
                                ? alpha(theme.palette[stat.tone].main, theme.palette.mode === 'dark' ? 0.12 : 0.06)
                                : 'action.hover',
                              borderRadius: 1.5,
                              textAlign: 'center',
                              gridColumn: stat.tone ? 'auto' : '1 / -1',
                            })}
                          >
                            <Typography
                              variant='h6'
                              fontWeight={600}
                              sx={(theme) => ({
                                color: stat.tone
                                  ? theme.palette[stat.tone][theme.palette.mode === 'dark' ? 'light' : 'dark']
                                  : 'text.secondary',
                              })}
                            >
                              {stat.value}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {stat.label}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </>
                  ) : (
                    <Typography variant='body2' color='text.secondary'>
                      Sin sesiones de asistencia.
                    </Typography>
                  )}
                  {attendanceHref && (
                    <Button
                      href={attendanceHref}
                      variant='outlined'
                      size='medium'
                      startIcon={<EventAvailableOutlinedIcon />}
                      sx={{ alignSelf: 'flex-start' }}
                    >
                      Ver asistencia
                    </Button>
                  )}
                </Stack>
              ) : activities.length ? (
                <Box>
                  <Stack direction='row' justifyContent='space-between' sx={{ py: 1.5 }}>
                    <Typography variant='caption' color='text.secondary'>
                      Actividad · Entrega
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Nota / 100
                    </Typography>
                  </Stack>
                  {activities.map((activity) => {
                    const grade = grades.find((item) => item.activity?.idActivity === activity.idActivity);

                    return (
                      <Box key={activity.idActivity}>
                        <Divider />
                        <Stack
                          direction='row'
                          spacing={2}
                          alignItems='center'
                          justifyContent='space-between'
                          sx={{ py: 1.5 }}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant='body2' fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                              {activity.name}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {activity.dueDate ? formatGradeDeadline(activity.dueDate) : '--'}
                            </Typography>
                            {activity.description && (
                              <Typography variant='body2' color='text.secondary' sx={{ overflowWrap: 'anywhere' }}>
                                {activity.description}
                              </Typography>
                            )}
                          </Box>
                          <Box
                            sx={{
                              flexShrink: 0,
                              px: 1.5,
                              py: 0.5,
                              minWidth: 52,
                              borderRadius: 1,
                              bgcolor: grade ? 'action.hover' : 'transparent',
                              color: grade ? 'text.primary' : 'text.disabled',
                              textAlign: 'right',
                            }}
                          >
                            <StudentGradeCell score={grade ? Number(grade.score) : null} total />
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Stack spacing={1} sx={{ pt: 2 }}>
                  <Typography variant='body2' color='text.secondary'>
                    {directGrade ? 'Calificación directa / 100' : 'Sin calificación directa.'}
                  </Typography>
                  <StudentGradeCell score={directGrade ? Number(directGrade.score) : null} total />
                </Stack>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
