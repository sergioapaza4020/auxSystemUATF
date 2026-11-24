import { Chip, Stack, Typography } from '@mui/material';

import type { IAttendanceLifecycle } from '@/interfaces/attendances/attendance.interface';

import { attendanceStateLabels } from '@/utils/attendance-geolocation';

export function AttendanceSessionBadge({ session }: { session: IAttendanceLifecycle }) {
  if (session.mode !== 'GEOLOCATION' && session.mode !== 'QR' && session.mode !== 'GEOLOCATION_QR')
    return <Chip size='small' variant='outlined' label='Manual' />;

  return (
    <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
      <Chip
        size='small'
        variant='outlined'
        label={
          session.mode === 'GEOLOCATION_QR' ? 'QR + ubicación' : session.mode === 'QR' ? 'Código QR' : 'Geolocalización'
        }
      />

      {session.startsAt && (
        <Typography variant='caption'>
          {new Date(session.startsAt).toLocaleTimeString('es-BO', {
            timeZone: 'America/La_Paz',
            hour: '2-digit',
            minute: '2-digit',
          })}
          {session.endsAt &&
            ` – ${new Date(session.endsAt).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz', hour: '2-digit', minute: '2-digit' })}`}
        </Typography>
      )}
      {session.state && (
        <Chip
          size='small'
          label={attendanceStateLabels[session.state]}
          color={
            session.state === 'OPEN'
              ? 'success'
              : session.state === 'SCHEDULED'
                ? 'info'
                : session.state === 'CANCELLED'
                  ? 'error'
                  : 'default'
          }
        />
      )}
    </Stack>
  );
}
