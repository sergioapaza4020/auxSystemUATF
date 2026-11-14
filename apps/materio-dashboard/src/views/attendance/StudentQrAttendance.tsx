'use client';

import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';

import { useStudentQrAttendance } from '@/hooks/attendances/useStudentQrAttendance';
import { attendanceLocalTime } from '@/utils/attendance-geolocation';

const statusLabels = { PRESENT: 'Presente', ABSENT: 'Ausente', EXCUSED: 'Permiso' };
const methodLabels = { QR: 'Código QR', MANUAL: 'Registro manual', GEOLOCATION: 'Geolocalización' };
const local = (date: string) => attendanceLocalTime(date).replace('T', ' ');

export function StudentQrAttendance() {
  const qr = useStudentQrAttendance();
  const busy = ['INITIALIZING', 'LOADING_CONTEXT', 'SUBMITTING'].includes(qr.phase);

  return (
    <Container component='main' maxWidth='sm' sx={{ py: { xs: 4, sm: 8 }, px: { xs: 2, sm: 3 } }}>
      <Paper variant='outlined' sx={{ p: { xs: 3, sm: 5 }, borderRadius: 2 }}>
        <Stack spacing={3} aria-live='polite' aria-atomic='true'>
          <Typography variant='overline'>UATF · Asistencia</Typography>
          <Typography variant='h4' component='h1'>
            {qr.phase === 'SUCCESS'
              ? 'Asistencia registrada correctamente'
              : qr.phase === 'ERROR' && !qr.context
                ? 'Código QR no disponible'
                : 'Registrar asistencia'}
          </Typography>
          {busy && (
            <Box role='status' sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CircularProgress
                size={24}
                aria-label={qr.phase === 'SUBMITTING' ? 'Registrando asistencia' : 'Verificando sesión de asistencia'}
              />
              <Typography>
                {qr.phase === 'SUBMITTING' ? 'Registrando asistencia...' : 'Verificando sesión de asistencia...'}
              </Typography>
            </Box>
          )}
          {qr.context && (
            <Stack spacing={1}>
              <Typography variant='h6'>{qr.context.course.name}</Typography>
              {qr.context.course.group != null && <Typography>Grupo: {qr.context.course.group}</Typography>}
              <Typography>Fecha: {qr.context.date.slice(0, 10)}</Typography>
              <Typography>Inicio: {local(qr.context.startsAt)}</Typography>
              <Typography>Finalización: {local(qr.context.endsAt)}</Typography>
              <Typography variant='caption'>Horario de Bolivia · America/La_Paz</Typography>
              <Typography>
                {['READY', 'SUBMITTING'].includes(qr.phase)
                  ? 'Sesión abierta'
                  : 'Estado y registro verificados por el servidor'}
              </Typography>
            </Stack>
          )}
          {qr.message && (
            <Alert
              severity={qr.phase === 'SUCCESS' ? 'success' : qr.phase === 'ALREADY_REGISTERED' ? 'info' : 'warning'}
            >
              {qr.message}
            </Alert>
          )}
          {qr.mark && (
            <Stack spacing={1}>
              <Typography variant='h6'>Tu registro: {statusLabels[qr.mark.status]}</Typography>
              <Typography>Método: {methodLabels[qr.mark.registrationMethod]}</Typography>
              {qr.mark.markedAt && <Typography>Registrado: {local(qr.mark.markedAt)} (Bolivia)</Typography>}
              <Typography variant='body2'>
                Tu asistencia fue registrada. El resumen académico se actualizará cuando la sesión finalice.
              </Typography>
            </Stack>
          )}
          {qr.phase === 'AUTH_REQUIRED' && (
            <Button size='large' variant='contained' onClick={qr.login}>
              Iniciar sesión
            </Button>
          )}
          {qr.phase === 'READY' && !qr.mark && (
            <Button
              size='large'
              variant='contained'
              sx={{ minHeight: 52 }}
              onClick={qr.confirm}
              disabled={qr.rateLimited}
            >
              Confirmar asistencia
            </Button>
          )}
          {qr.phase === 'ERROR' && qr.hasToken && (
            <Button size='large' onClick={qr.retryContext} disabled={qr.rateLimited}>
              Verificar sesión nuevamente
            </Button>
          )}
          {qr.canRead && !busy && (
            <Button size='large' onClick={qr.readOwn} disabled={qr.reading || qr.rateLimited}>
              {qr.reading ? 'Consultando registro...' : 'Consultar mi registro'}
            </Button>
          )}
          {qr.rateLimited && <Typography variant='body2'>Espera antes de realizar otra consulta.</Typography>}
          <Button size='large' onClick={qr.abandon} disabled={qr.phase === 'SUBMITTING'}>
            Ir al panel
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
