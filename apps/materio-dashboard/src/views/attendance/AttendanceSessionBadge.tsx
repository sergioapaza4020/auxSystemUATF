import { Chip, Stack } from '@mui/material';

import type { IAttendanceLifecycle } from '@/interfaces/attendances/attendance.interface';

import { attendanceStateLabels } from '@/utils/attendance-geolocation';

export function AttendanceSessionBadge({ session }: { session: IAttendanceLifecycle }) {
  if (session.mode !== 'GEOLOCATION' && session.mode !== 'QR')
    return <Chip size='small' variant='outlined' label='Manual' />;

  return (
    <Stack direction='row' spacing={1} useFlexGap flexWrap='wrap'>
      <Chip size='small' variant='outlined' label={session.mode === 'QR' ? 'Código QR' : 'Geolocalización'} />

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
