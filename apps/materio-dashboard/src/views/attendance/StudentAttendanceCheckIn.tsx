'use client';

import { Alert, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { useAuth } from '@/hooks/useAuth';
import { useStudentAttendanceCheckIn } from '@/hooks/attendances/useStudentAttendanceCheckIn';
import type { IEnrollment } from '@/interfaces/enrollments/enrollment.interface';
import { UserRole } from '@/enums/userRole';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import { hasPermission } from '@/utils/hasPermission';

function localDate(value: string) {
  return new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function StudentAttendanceCheckIn({
  enrollment,
  onAcademicRefresh,
}: {
  enrollment: IEnrollment;
  onAcademicRefresh: () => void | Promise<void>;
}) {
  const { user } = useAuth();

  const own =
    user?.idUser === enrollment.user?.idUser &&
    enrollment.role === UserRole.STUDENT &&
    enrollment.isActive &&
    Number.isSafeInteger(enrollment.idEnrollment) &&
    enrollment.idEnrollment > 0;

  if (!own) return null;
  if (!hasPermission(user, 'attendance.check-in'))
    return (
      <Alert severity='info'>
        El registro de asistencia no está habilitado para tu cuenta. Contacta al auxiliar o al administrador para
        revisar tu acceso.
      </Alert>
    );

  return (
    <StudentAttendanceRegistration
      key={enrollment.idEnrollment}
      idEnrollment={enrollment.idEnrollment}
      onAcademicRefresh={onAcademicRefresh}
    />
  );
}

export function StudentAttendanceRegistration({
  idEnrollment,
  onAcademicRefresh,
}: {
  idEnrollment: number;
  onAcademicRefresh: () => void | Promise<void>;
}) {
  const state = useStudentAttendanceCheckIn(idEnrollment, onAcademicRefresh);
  const open = state.sessions.filter((session) => session.state === 'OPEN');
  const upcoming = state.sessions.find((session) => session.state === 'SCHEDULED');
  const visible = [...open, ...(upcoming ? [upcoming] : [])];
  const busy = state.phase !== 'IDLE';

  return (
    <Card component='section' aria-labelledby='student-attendance-registration-title'>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction='row' spacing={1} alignItems='center' justifyContent='space-between'>
            <Typography variant='h6' id='student-attendance-registration-title'>
              Registro de asistencia
            </Typography>
            <Button
              disabled={state.loading || busy}
              onClick={() => {
                void Promise.allSettled([state.reload(), Promise.resolve().then(onAcademicRefresh)]);
              }}
            >
              Actualizar
            </Button>
          </Stack>
          {state.loading && <CircularProgress size={24} aria-label='Consultando sesiones de asistencia' />}
          {state.listError && <Alert severity='error'>{state.listError}</Alert>}
          {state.feedback && (
            <Alert severity={state.feedback.severity} aria-live='polite'>
              {state.feedback.message}
            </Alert>
          )}
          {!state.loading && !state.listError && !visible.length && (
            <Typography variant='body2' color='text.secondary'>
              No hay una sesión de asistencia disponible en este momento.
            </Typography>
          )}
          {visible.map((session) => (
            <Stack
              key={session.idAttendanceSession}
              spacing={1.5}
              sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                justifyContent='space-between'
                alignItems={{ sm: 'center' }}
              >
                <Typography fontWeight={600}>
                  {session.state === 'OPEN' ? 'Asistencia disponible' : 'Próxima sesión de asistencia'} · Sesión #
                  {session.idAttendanceSession}
                </Typography>
                <Chip
                  size='small'
                  variant='outlined'
                  color={session.state === 'OPEN' ? 'success' : 'info'}
                  label={session.state === 'OPEN' ? 'Abierta' : 'Programada'}
                  sx={{ alignSelf: 'flex-start' }}
                />
              </Stack>
              <Typography variant='body2'>
                {localDate(session.startsAt)} – {localDate(session.endsAt)} · Bolivia
              </Typography>
              {session.alreadyRegistered ? (
                <Stack spacing={0.5} role='status'>
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <CheckCircleOutlineIcon color='success' />
                    <Typography>Asistencia registrada{session.state === 'OPEN' ? ' · sesión en curso' : ''}</Typography>
                  </Stack>
                  {session.ownStatus && (
                    <Typography variant='body2'>
                      Estado:{' '}
                      {session.ownStatus === AttendanceStatus.PRESENT
                        ? 'Presente'
                        : session.ownStatus === AttendanceStatus.EXCUSED
                          ? 'Permiso'
                          : 'Ausente'}
                    </Typography>
                  )}
                  {session.ownMarkedAt && (
                    <Typography variant='caption'>Registrada: {localDate(session.ownMarkedAt)}</Typography>
                  )}
                </Stack>
              ) : session.state === 'SCHEDULED' ? (
                <Typography variant='body2'>Disponible desde {localDate(session.startsAt)}.</Typography>
              ) : (
                <>
                  <Typography variant='body2'>Debes estar dentro de la zona definida por el auxiliar.</Typography>
                  <Button
                    variant='contained'
                    size='large'
                    disabled={
                      busy ||
                      state.loading ||
                      !!state.listError ||
                      state.blockedIds.includes(session.idAttendanceSession)
                    }
                    onClick={() => void state.checkIn(session.idAttendanceSession)}
                    startIcon={
                      busy && state.activeSessionId === session.idAttendanceSession ? (
                        <CircularProgress size={18} color='inherit' />
                      ) : undefined
                    }
                    sx={{ minHeight: 48, alignSelf: { xs: 'stretch', sm: 'flex-start' } }}
                  >
                    {state.activeSessionId === session.idAttendanceSession && state.phase === 'OBTAINING_LOCATION'
                      ? 'Obteniendo ubicación...'
                      : state.activeSessionId === session.idAttendanceSession && state.phase === 'CHECKING_IN'
                        ? 'Verificando ubicación...'
                        : 'Marcar asistencia'}
                  </Button>
                </>
              )}
            </Stack>
          ))}
          {state.hasMore && (
            <Typography variant='caption' color='text.secondary'>
              Hay más sesiones disponibles. Esta sección muestra las abiertas recibidas y la próxima programada.
            </Typography>
          )}
          <Typography variant='caption' color='text.secondary'>
            Tu ubicación se solicita únicamente cuando pulsas “Marcar asistencia”. Se envía al servidor para validar
            este registro y no se realiza seguimiento continuo.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
