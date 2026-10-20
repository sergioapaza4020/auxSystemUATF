import { Alert, Box, Button, Card, CircularProgress, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import CloseOutlinedIcon from '@mui/icons-material/CloseOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';

import type { IAttendanceSessionSummary } from '@/interfaces/attendances/attendance.interface';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import { attendanceStatusColor } from '@/utils/attendance-status';
import { permissionWeightToPercentage } from '@/utils/attendance-permission';

interface Props {
  sessions: IAttendanceSessionSummary[];
  summary: IAttendanceSessionSummary | null;
  selectedSessionId: number | null;
  present: number;
  excused: number;
  absent: number;
  total: number;
  hasChanges: boolean;
  loading: boolean;
  permissionWeight: number | null;
  configLoading: boolean;
  configError: boolean;
  canEditConfig: boolean;
  disabled: boolean;
  onOpenSession: (id: number) => void;
  onViewHistory: () => void;
  onEditConfig: () => void;
}

export function AttendanceSidebar(props: Props) {
  const summary = props.summary;
  const percentage = summary?.percentage;

  const counts = [
    {
      status: AttendanceStatus.PRESENT,
      label: 'Presentes',
      value: props.present,
      icon: <CheckOutlinedIcon fontSize='small' />,
    },
    {
      status: AttendanceStatus.EXCUSED,
      label: 'Permisos',
      value: props.excused,
      icon: <ScheduleOutlinedIcon fontSize='small' />,
    },
    {
      status: AttendanceStatus.ABSENT,
      label: 'Ausentes',
      value: props.absent,
      icon: <CloseOutlinedIcon fontSize='small' />,
    },
  ];

  return (
    <Stack spacing={3}>
      <Card sx={{ p: 3 }}>
        <Typography variant='h6' fontWeight={700}>
          Resumen de la sesión
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          {summary ? summary.date.slice(0, 10).split('-').reverse().join('/') : 'Abre o crea una sesión para empezar.'}
        </Typography>
        {props.selectedSessionId && (
          <>
            <Typography variant='caption' color='text.secondary'>
              Asistencia {props.hasChanges ? 'guardada' : ''}
            </Typography>
            <Typography variant='h4' sx={{ mb: 1 }}>
              {percentage == null ? '—' : `${percentage.toFixed(1)}%`}
            </Typography>
            {percentage != null && (
              <LinearProgress variant='determinate' value={percentage} sx={{ height: 7, borderRadius: 1, mb: 2 }} />
            )}
            <Stack spacing={1.5}>
              {counts.map((item) => (
                <Stack key={item.status} direction='row' alignItems='center' justifyContent='space-between'>
                  <Stack
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    sx={{ color: attendanceStatusColor(item.status) }}
                  >
                    {item.icon}
                    <Typography variant='body2'>{item.label}</Typography>
                  </Stack>
                  <Typography variant='body2' fontWeight={600}>
                    {item.value}
                  </Typography>
                </Stack>
              ))}
              <Divider />
              <Stack direction='row' justifyContent='space-between'>
                <Typography variant='body2'>Total</Typography>
                <Typography variant='body2' fontWeight={600}>
                  {props.total}
                </Typography>
              </Stack>
            </Stack>
            {props.hasChanges && (
              <Typography role='status' variant='caption' color='text.secondary' sx={{ display: 'block', mt: 2 }}>
                Los conteos reflejan tus cambios. Guarda para actualizar el porcentaje.
              </Typography>
            )}
          </>
        )}
        <Alert severity='info' icon={false} sx={{ mt: 2 }}>
          <Typography variant='caption'>Los estudiantes sin asistencia marcada se consideran ausentes.</Typography>
        </Alert>
      </Card>
      <Card sx={{ p: 3 }}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
          flexWrap='wrap'
          useFlexGap
          spacing={1}
          sx={{ mb: 2 }}
        >
          <Typography variant='h6' fontWeight={700}>
            Historial rápido
          </Typography>
          <Button size='small' onClick={props.onViewHistory} endIcon={<ArrowForwardOutlinedIcon fontSize='small' />}>
            Ver todas
          </Button>
        </Stack>
        {props.loading ? (
          <CircularProgress size={20} aria-label='Cargando historial rápido' />
        ) : !props.sessions.length ? (
          <Typography variant='body2' color='text.secondary'>
            No hay sesiones de asistencia registradas.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {props.sessions.map((item) => (
              <Box key={item.idAttendanceSession} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                <Stack direction='row' justifyContent='space-between' alignItems='center'>
                  <Button
                    size='small'
                    disabled={props.disabled}
                    onClick={() => props.onOpenSession(item.idAttendanceSession)}
                    aria-label={`Abrir sesión del ${item.date.slice(0, 10).split('-').reverse().join('/')}`}
                    sx={{ px: 0, minWidth: 0 }}
                  >
                    {item.date.slice(0, 10).split('-').reverse().join('/')}
                  </Button>
                  <Typography variant='body2'>{item.percentage.toFixed(1)}%</Typography>
                </Stack>
                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                  <Typography variant='caption' color={attendanceStatusColor(AttendanceStatus.PRESENT)}>
                    {item.presentCount} presentes
                  </Typography>
                  <Typography variant='caption' color={attendanceStatusColor(AttendanceStatus.EXCUSED)}>
                    {item.excusedCount} permisos
                  </Typography>
                  <Typography variant='caption' color={attendanceStatusColor(AttendanceStatus.ABSENT)}>
                    {item.absentCount} ausentes
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Card>
      <Card sx={{ p: 3 }}>
        <Typography variant='h6' fontWeight={700}>
          Configuración de asistencia
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          Valor de cada estado en el esquema académico.
        </Typography>
        <Stack spacing={1.5} sx={{ my: 2 }}>
          {counts.map((item, index) => (
            <Stack key={item.status} direction='row' justifyContent='space-between' alignItems='center'>
              <Stack direction='row' alignItems='center' spacing={1} sx={{ color: attendanceStatusColor(item.status) }}>
                {item.icon}
                <Typography variant='body2'>{['Presente', 'Permiso', 'Ausente'][index]}</Typography>
              </Stack>
              <Typography variant='body2' fontWeight={600}>
                {index === 0
                  ? '100%'
                  : index === 2
                    ? '0%'
                    : props.configLoading
                      ? '…'
                      : props.permissionWeight == null
                        ? '—'
                        : `${permissionWeightToPercentage(props.permissionWeight)}%`}
              </Typography>
            </Stack>
          ))}
        </Stack>
        {(props.configError || (!props.configLoading && props.permissionWeight == null)) && (
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 2 }}>
            {props.configError
              ? 'No se pudo cargar la configuración.'
              : 'Configura el criterio de asistencia en el esquema académico de la materia.'}
          </Typography>
        )}
        {props.canEditConfig && (
          <Button
            fullWidth
            variant='outlined'
            size='small'
            startIcon={<SettingsOutlinedIcon />}
            onClick={props.onEditConfig}
            disabled={props.disabled || props.configLoading || props.permissionWeight == null}
          >
            Editar configuración
          </Button>
        )}
      </Card>
    </Stack>
  );
}
