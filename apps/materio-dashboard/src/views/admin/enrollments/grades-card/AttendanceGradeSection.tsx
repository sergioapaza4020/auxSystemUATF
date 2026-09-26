import { Box, Chip, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';

import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';

import type { IStudentAttendance } from '@/interfaces/attendances/attendance.interface';

interface AttendanceGradeSectionProps {
  name: string;
  percentage: number;
  attendance?: IStudentAttendance | null;
  loading: boolean;
  schemeMultiplier: number;
}

export function AttendanceGradeSection({
  name,
  percentage,
  attendance,
  loading,
  schemeMultiplier,
}: AttendanceGradeSectionProps) {
  const attendancePercentage = attendance?.percentage ?? null;

  const contribution =
    attendancePercentage !== null ? (Number(attendancePercentage) * percentage * schemeMultiplier) / 100 : null;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        p: 3,
      }}
    >
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent='space-between'
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={3}
      >
        <Stack direction='row' spacing={2} alignItems='center'>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              bgcolor: 'info.lighterOpacity',
              color: 'info.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <EventAvailableOutlinedIcon fontSize='small' />
          </Box>

          <Box>
            <Stack direction='row' spacing={1.5} alignItems='center'>
              <Typography fontWeight={600}>{name}</Typography>

              <Chip size='small' variant='tonal' label={`${percentage}%`} />
            </Stack>

            <Typography variant='body2' color='text.secondary'>
              Calculada automáticamente según las sesiones registradas
            </Typography>
          </Box>
        </Stack>

        {loading ? (
          <CircularProgress size={24} />
        ) : attendance ? (
          <Stack
            spacing={0.75}
            sx={{
              width: {
                xs: '100%',
                md: 280,
              },
            }}
          >
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='body2' color='text.secondary'>
                {attendance.presentSessions} de {attendance.totalSessions} sesiones
              </Typography>

              <Typography fontWeight={700}>{Number(attendance.percentage).toFixed(2)}%</Typography>
            </Stack>

            <LinearProgress
              variant='determinate'
              value={Math.min(Number(attendance.percentage), 100)}
              sx={{
                height: 6,
                borderRadius: 10,
              }}
            />

            {contribution !== null && (
              <Typography variant='caption' color='text.secondary' textAlign='right'>
                Aporte: {contribution.toFixed(2)}
              </Typography>
            )}
          </Stack>
        ) : (
          <Chip size='small' variant='tonal' label='Sin registros' />
        )}
      </Stack>
    </Box>
  );
}
