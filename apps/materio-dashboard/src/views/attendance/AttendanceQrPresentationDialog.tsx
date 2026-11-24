'use client';

import { useRef } from 'react';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';

import type { IAttendanceSession } from '@/interfaces/attendances/attendance.interface';
import { attendanceQrOrigin, attendanceQrUrl } from '@/configs/attendanceQr';
import { useQrFullscreen } from '@/hooks/attendances/useQrFullscreen';
import { useAttendanceQr } from '@/hooks/attendances/useAttendanceQr';

export function AttendanceQrPresentationDialog({
  session,
  course,
  onClose,
  onUnavailable,
}: {
  session: IAttendanceSession;
  course: string;
  onClose: () => void;
  onUnavailable: () => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const { fullscreen, error: fullscreenError, toggle: toggleFullscreen } = useQrFullscreen(container);
  const origin = attendanceQrOrigin();
  const { code, fetching, remaining, error, retry } = useAttendanceQr(session, !!origin, onUnavailable);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='lg' aria-labelledby='attendance-qr-presentation-title'>
      <Box
        ref={container}
        sx={{ bgcolor: 'background.paper', overflow: 'auto', minHeight: fullscreen ? '100vh' : undefined }}
      >
        <DialogTitle id='attendance-qr-presentation-title'>Código QR de asistencia</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} alignItems='center'>
            <Typography variant='h5' align='center'>
              {course}
            </Typography>
            <Typography color='success.main'>
              Sesión {session.state === 'OPEN' ? 'abierta' : 'no disponible'} · UATF
            </Typography>
            {!origin && (
              <Alert severity='warning'>
                Configura un origen público HTTPS accesible desde teléfonos para presentar el QR.
              </Alert>
            )}
            {error && <Alert severity='warning'>{error}</Alert>}
            {code && origin ? (
              <Box
                sx={{
                  bgcolor: '#fff',
                  width: '100%',
                  maxWidth: fullscreen
                    ? 'min(680px, max(160px, calc(100dvh - 360px)))'
                    : 'min(520px, max(160px, calc(100dvh - 360px)))',
                  aspectRatio: '1',
                  display: 'grid',
                  placeItems: 'center',
                  p: 1,
                }}
              >
                <QRCodeSVG
                  value={attendanceQrUrl(origin, code.token)}
                  size={640}
                  marginSize={4}
                  level='M'
                  bgColor='#ffffff'
                  fgColor='#000000'
                  title='Código QR temporal de asistencia'
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </Box>
            ) : (
              origin && (
                <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
                  {fetching ? (
                    <CircularProgress aria-label='Obteniendo código QR' />
                  ) : (
                    <Typography>Código no disponible. Solicita uno vigente.</Typography>
                  )}
                </Box>
              )
            )}
            {code && (
              <Typography variant='h6'>
                Se renueva en {remaining} s{fetching ? ' · Actualizando…' : ''}
              </Typography>
            )}
            <Typography variant='caption' color='text.secondary'>
              El tiempo es orientativo. El servidor determina la vigencia.
            </Typography>
            <Alert severity='info'>
              {session.mode === 'GEOLOCATION_QR'
                ? 'Escanea el código, inicia sesión si es necesario y valida tu ubicación para confirmar asistencia.'
                : 'Los estudiantes deben iniciar sesión y pulsar Confirmar asistencia después de escanear. Abrir el enlace no registra asistencia.'}
            </Alert>
            {fullscreenError && <Alert severity='info'>{fullscreenError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={toggleFullscreen}>{fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}</Button>
          {origin && error && (
            <Button onClick={retry} disabled={fetching}>
              Reintentar
            </Button>
          )}
          <Button onClick={onClose}>Cerrar presentación</Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
