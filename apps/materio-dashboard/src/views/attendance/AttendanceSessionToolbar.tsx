import { Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';

import { DateField } from '@/components/DateField';
import type { IAttendanceLifecycle } from '@/interfaces/attendances/attendance.interface';

interface AttendanceSessionToolbarProps {
  selectedDate: string;
  selectedSessionId: number | null;
  session: ({ date?: string } & IAttendanceLifecycle) | null;
  saving: boolean;
  canCreate?: boolean;
  hasChanges: boolean;
  onDateChange: (date: string) => void;
  onCreateSession: () => void;
  onConfigureQr?: () => void;
  onShowQr?: () => void;
  onEditTopic?: () => void;
}

export function AttendanceSessionToolbar({
  selectedDate,
  selectedSessionId,
  session,
  saving,
  canCreate = true,
  hasChanges,
  onDateChange,
  onCreateSession,
  onConfigureQr,
  onShowQr,
  onEditTopic,
}: AttendanceSessionToolbarProps) {
  const date = session?.date?.slice(0, 10).split('-');
  const sessionDate = date ? `${date[2]}/${date[1]}/${date[0]}` : '';

  return (
    <Paper variant='outlined' sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2 }}>
      <Stack
        direction={{ xs: 'column', xl: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', xl: 'center' }}
        justifyContent='space-between'
      >
        <Stack direction='row' spacing={1.5} alignItems='center'>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              bgcolor: 'primary.lighterOpacity',
              color: 'primary.main',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <CalendarMonthOutlinedIcon />
          </Box>
          <Box>
            <Typography variant='h6' fontWeight={600}>
              Sesión de asistencia
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Crea una sesión o selecciona una sesión del historial.
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          flexWrap='wrap'
          useFlexGap
        >
          <DateField
            label='Fecha'
            size='small'
            value={selectedDate}
            disabled={
              saving ||
              (!!selectedSessionId &&
                (session?.mode === 'GEOLOCATION' || session?.mode === 'QR' || session?.mode === 'GEOLOCATION_QR'))
            }
            onChange={onDateChange}
            sx={{ width: { xs: '100%', sm: 175 } }}
          />
          {selectedSessionId && session && (
            <Box sx={{ minWidth: 0, maxWidth: { xs: '100%', sm: 280 }, overflowWrap: 'anywhere' }}>
              <Typography variant='body2'>{session.topic?.trim() || 'Sin tema'}</Typography>
              {onEditTopic && (
                <Button size='small' disabled={saving || hasChanges} onClick={onEditTopic}>
                  Editar tema
                </Button>
              )}
            </Box>
          )}
          {!selectedSessionId && (
            <Typography variant='caption' color='text.secondary'>
              Nueva sesión · aún no creada
            </Typography>
          )}
          {selectedSessionId && session?.date && (
            <Stack spacing={0.5} role='status'>
              <Chip
                size='small'
                variant='outlined'
                icon={<EditOutlinedIcon />}
                label={`Editando sesión #${selectedSessionId} del ${sessionDate}`}
              />
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                {!hasChanges && <CheckCircleOutlinedIcon sx={{ fontSize: 14 }} />}
                {hasChanges ? 'Cambios sin guardar' : 'Sesión guardada'}
              </Typography>
            </Stack>
          )}
          {session?.mode === 'QR' && onConfigureQr && (
            <Button onClick={onConfigureQr} disabled={saving || hasChanges}>
              {session.state === 'DRAFT' ? 'Configurar QR' : 'Ver sesión QR'}
            </Button>
          )}
          {(session?.mode === 'QR' || session?.mode === 'GEOLOCATION_QR') && session.state === 'OPEN' && onShowQr && (
            <Button variant='contained' onClick={onShowQr} disabled={saving || hasChanges}>
              Mostrar QR
            </Button>
          )}
          <Button
            variant='outlined'
            startIcon={<AddOutlinedIcon />}
            disabled={saving || !canCreate || !selectedDate}
            onClick={onCreateSession}
          >
            Nueva sesión
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
