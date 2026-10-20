'use client';

import { useState } from 'react';

import { Alert, Avatar, Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import type { Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import type { IAssistantGradeScheme } from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';
import type { IIndividualStudentGradeSummary } from '@/interfaces/enrollments/student-grade-summary.interface';
import type { IGrade } from '@/interfaces/grades/grade.interface';
import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';
import { DEFAULT_GRADE_DISPLAY_MODE, GradeViewToggle, type GradeDisplayMode } from '../GradeViewToggle';
import { StudentGradeCell } from '../StudentGradeCell';
import { AcademicCriteria, academicSurfaceStyles } from './AcademicCriteria';

export interface StudentAcademicRecordProps {
  idEnrollment: number;
  enrollment: IEnrollment;
  scheme: IAssistantGradeScheme | null;
  summary: IIndividualStudentGradeSummary;
  grades: IGrade[];
  attendance: IStudentAttendance | null;
  attendanceError?: string | null;
  canEdit: boolean;
  canViewAttendance: boolean;
  onManageDirect?: () => void;
}

const metricStyles = (theme: Theme) => ({
  '& > .MuiTypography-root': { ...theme.typography.h3, fontWeight: 700, color: 'primary.main' },
});

const metricSurfaceStyles = (theme: Theme) => ({
  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.1 : 0.04),
  border: '1px solid',
  borderColor: alpha(theme.palette.primary.main, 0.1),
  borderRadius: 2,
  p: 3,
});

export function StudentAcademicRecord({
  idEnrollment,
  enrollment,
  scheme,
  summary,
  grades,
  attendance,
  attendanceError,
  canEdit,
  canViewAttendance,
  onManageDirect,
}: StudentAcademicRecordProps) {
  const [mode, setMode] = useState<GradeDisplayMode>(DEFAULT_GRADE_DISPLAY_MODE);
  const student = summary.student;
  const baseUrl = `/dashboard/enrollments/${idEnrollment}`;
  const { user, course } = enrollment;
  const details = [...(scheme?.details ?? [])].sort((a, b) => a.order - b.order);

  return (
    <Stack spacing={3}>
      <Button href={baseUrl} startIcon={<ArrowBackIcon />} sx={{ alignSelf: 'flex-start' }}>
        Volver a la materia
      </Button>
      <Card sx={academicSurfaceStyles}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            alignItems={{ md: 'center' }}
            justifyContent='space-between'
          >
            <Stack direction='row' spacing={3} alignItems='center' sx={{ minWidth: 0 }}>
              <Avatar
                src={user.avatar ?? undefined}
                sx={(theme) => ({
                  width: 56,
                  height: 56,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  fontWeight: 600,
                })}
              >
                {user.name[0]}
                {user.lastname[0]}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant='h4' fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                  {user.name} {user.lastname}
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                  CI {user.ci || '--'} · RU {user.ru || '--'}
                </Typography>
                <Stack
                  direction='row'
                  spacing={1}
                  alignItems='center'
                  sx={{ mt: 1, bgcolor: 'action.hover', borderRadius: 1, px: 1.5, py: 0.5, width: 'fit-content' }}
                >
                  <MenuBookOutlinedIcon fontSize='small' color='action' />
                  <Typography variant='caption' color='text.secondary'>
                    {course.code} · {course.name} · Grupo {course.group}
                  </Typography>
                </Stack>
              </Box>
            </Stack>
            {canEdit && (
              <Button
                href={`${baseUrl}/grades`}
                variant='contained'
                size='medium'
                startIcon={<EditNoteOutlinedIcon />}
                sx={{ flexShrink: 0, alignSelf: { xs: 'flex-start', md: 'center' } }}
              >
                Gestionar calificaciones
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
      {!scheme || !summary.scheme ? (
        <Alert severity='info'>Todavía no se ha configurado la evaluación del auxiliar para esta materia.</Alert>
      ) : (
        <>
          <Card component='section' aria-label='Rendimiento' sx={academicSurfaceStyles}>
            <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                justifyContent='space-between'
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                sx={{ mb: 3 }}
              >
                <Stack direction='row' spacing={1.5} alignItems='center'>
                  <TrendingUpOutlinedIcon color='primary' />
                  <Typography variant='h5' fontWeight={600}>
                    Rendimiento
                  </Typography>
                </Stack>
                <GradeViewToggle
                  value={mode}
                  onChange={setMode}
                  sx={(theme) => ({
                    bgcolor: 'action.hover',
                    border: '1px solid',
                    borderColor: 'divider',
                    p: 0.5,
                    borderRadius: 2,
                    '& .MuiToggleButton-root': {
                      px: 2,
                      py: 1.5,
                      minHeight: 44,
                      border: 0,
                      borderRadius: 'inherit',
                      typography: 'body2',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    },
                    '& .MuiToggleButton-root.Mui-selected': {
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      '&:hover': { bgcolor: 'primary.dark' },
                    },
                    '& .MuiToggleButton-root.Mui-focusVisible': {
                      outline: `2px solid ${theme.palette.primary.main}`,
                      outlineOffset: 2,
                    },
                  })}
                />
              </Stack>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                }}
              >
                <Box sx={metricSurfaceStyles}>
                  <Typography variant='body2' color='text.secondary'>
                    Nota del auxiliar
                  </Typography>
                  <Box sx={metricStyles}>
                    <StudentGradeCell
                      score={student?.assistantContribution}
                      maximum={summary.scheme.assistantPercentage}
                      total
                    />
                  </Box>
                </Box>
                <Box sx={metricSurfaceStyles}>
                  <Typography variant='body2' color='text.secondary'>
                    Rendimiento general · Sobre 100%
                  </Typography>
                  <Box sx={metricStyles}>
                    <StudentGradeCell score={student?.totalRaw} maximum={100} total />
                  </Box>
                  {student?.totalRaw != null && (
                    <LinearProgress
                      aria-label='Rendimiento general sobre 100'
                      variant='determinate'
                      value={student.totalRaw}
                      sx={{ mt: 1.5, borderRadius: 1 }}
                    />
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
          {details.length === 0 && <Alert severity='info'>El esquema todavía no tiene criterios.</Alert>}
          <AcademicCriteria
            scheme={scheme}
            results={student?.details ?? []}
            maxima={summary.scheme?.details ?? []}
            grades={grades}
            attendance={attendance}
            attendanceError={attendanceError}
            mode={mode}
            attendanceHref={canViewAttendance ? `${baseUrl}/attendance` : undefined}
          />

          {canEdit && onManageDirect && (
            <Button onClick={onManageDirect} sx={{ alignSelf: 'flex-start' }}>
              Gestionar criterios directos
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}
