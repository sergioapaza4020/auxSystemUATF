'use client';

import { useEffect, useRef, useState } from 'react';

import dynamic from 'next/dynamic';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import 'dayjs/locale/es';

import {
  activateSession,
  cancelSession,
  closeSession,
  configureGeolocation,
  openSessionNow,
} from '@/api/attendances.service';
import type { AttendanceGeolocationConfig } from '@/api/attendances.service';
import type { IAttendanceSession } from '@/interfaces/attendances/attendance.interface';
import { useSnackbar } from '@/hooks/useSnackbar';
import {
  assistantLocationError,
  attendanceInstant,
  attendanceLocalTime,
  getAttendanceGeoErrorMessage,
} from '@/utils/attendance-geolocation';
import { AttendanceSessionBadge } from './AttendanceSessionBadge';
import { requestCurrentBrowserPosition } from '@/utils/browser-geolocation';

export const AttendanceMap = dynamic(() => import('./AttendanceGeolocationMap'), {
  ssr: false,
  loading: () => (
    <Box sx={{ height: 280, display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label='Cargando mapa' />
    </Box>
  ),
});

type Action = 'activate' | 'openNow' | 'close' | 'cancel';
const actions = { activate: activateSession, openNow: openSessionNow, close: closeSession, cancel: cancelSession };

const actionTitles: Record<Action, string> = {
  activate: 'Activar sesión',
  openNow: 'Abrir ahora',
  close: 'Cerrar sesión',
  cancel: 'Cancelar sesión',
};

const success: Record<Action, string> = {
  activate: 'Sesión activada.',
  openNow: 'Sesión abierta.',
  close: 'Sesión cerrada.',
  cancel: 'Sesión cancelada.',
};

export function AttendanceGeolocationDialog({
  session,
  canUpdate,
  onClose,
  onRefresh,
}: {
  session: IAttendanceSession;
  canUpdate: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const snackbar = useSnackbar();
  const draft = session.state === 'DRAFT';
  const [latitude, setLatitude] = useState<number | null>(session.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(session.longitude ?? null);

  // No backend defaults exist. These are editable UX suggestions, not saved until confirmation.
  const [radius, setRadius] = useState(String(session.radiusMeters ?? 50));
  const [accuracy, setAccuracy] = useState(String(session.maximumAcceptedAccuracy ?? 50));
  const [start, setStart] = useState(attendanceLocalTime(session.startsAt));
  const [end, setEnd] = useState(attendanceLocalTime(session.endsAt));
  const [baseline, setBaseline] = useState(() => JSON.stringify([latitude, longitude, radius, accuracy, start, end]));
  const [busy, setBusy] = useState<Action | 'save' | 'refresh' | null>(null);
  const [confirmation, setConfirmation] = useState<Action | 'discard' | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationMessage, setLocationMessage] = useState('');
  const [validation, setValidation] = useState('');
  const locationRequest = useRef(0);
  const snapshot = JSON.stringify([latitude, longitude, radius, accuracy, start, end]);
  const dirty = draft && snapshot !== baseline;
  const disabled = !draft || !canUpdate || !!busy;

  useEffect(() => {
    if (draft) return;
    setLatitude(session.latitude ?? null);
    setLongitude(session.longitude ?? null);
    setRadius(String(session.radiusMeters ?? 50));
    setAccuracy(String(session.maximumAcceptedAccuracy ?? 50));
    setStart(attendanceLocalTime(session.startsAt));
    setEnd(attendanceLocalTime(session.endsAt));
  }, [
    draft,
    session.latitude,
    session.longitude,
    session.radiusMeters,
    session.maximumAcceptedAccuracy,
    session.startsAt,
    session.endsAt,
  ]);

  useEffect(
    () => () => {
      locationRequest.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (!dirty) return;

    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', leave);

    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);

  const config = (): AttendanceGeolocationConfig | null => {
    const startsAt = attendanceInstant(start);
    const endsAt = attendanceInstant(end);
    const radiusMeters = Number(radius);
    const maximumAcceptedAccuracy = Number(accuracy);

    if (
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isInteger(radiusMeters) ||
      radiusMeters <= 0 ||
      radiusMeters > 2147483647 ||
      !Number.isInteger(maximumAcceptedAccuracy) ||
      maximumAcceptedAccuracy <= 0 ||
      maximumAcceptedAccuracy > 2147483647 ||
      !startsAt ||
      !endsAt ||
      endsAt <= startsAt
    )
      return null;

    // The configure DTO and numeric columns accept six decimal places.
    return {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      radiusMeters,
      maximumAcceptedAccuracy,
      startsAt,
      endsAt,
    };
  };

  const save = async () => {
    if (busy || !draft || !canUpdate) return;
    const data = config();

    if (!data) {
      setValidation(
        'Selecciona un punto y completa radio y precisión con enteros positivos, inicio y fin válidos (fin posterior al inicio).',
      );

      return;
    }

    setBusy('save');
    setValidation('');
    locationRequest.current += 1;
    setLocating(false);

    try {
      await configureGeolocation(session.idAttendanceSession, data);
      setBaseline(snapshot);
      snackbar.success('Configuración guardada.');

      try {
        await onRefresh();
      } catch {
        snackbar.warning('Configuración guardada. No se pudo actualizar la sesión; vuelve a consultarla.');
      }
    } catch (error) {
      snackbar.error(getAttendanceGeoErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const perform = async (action: Action) => {
    if (busy || !canUpdate) return;
    setConfirmation(null);
    setBusy(action);
    locationRequest.current += 1;
    setLocating(false);

    try {
      await actions[action](session.idAttendanceSession);
      snackbar.success(success[action]);

      try {
        await onRefresh();
      } catch {
        onClose();
        snackbar.warning('La operación se guardó. Actualiza la sesión para consultar su estado.');
      }
    } catch (error) {
      snackbar.error(getAttendanceGeoErrorMessage(error));

      // Refresh stale lifecycle state after a conflict; never retry the mutation automatically.
      try {
        await onRefresh();
      } catch {
        /* Keep the server error as the single notification. */
      }
    } finally {
      setBusy(null);
    }
  };

  const locate = () => {
    if (disabled || locating) return;

    if (!navigator.geolocation) {
      setLocationMessage('Tu navegador no permite obtener ubicación. Selecciona el punto en el mapa.');

      return;
    }

    const request = ++locationRequest.current;

    setLocating(true);
    setLocationMessage('');
    requestCurrentBrowserPosition(
      (position) => {
        if (request !== locationRequest.current) return;
        setLatitude(position.latitude);
        setLongitude(position.longitude);
        setLocationAccuracy(position.accuracy);
        setLocating(false);
      },
      (error) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setLocationMessage(assistantLocationError(error.code));
      },
    );
  };

  const requestClose = () => {
    if (!busy) {
      if (dirty) setConfirmation('discard');
      else onClose();
    }
  };

  const complete = !!config();

  const savedComplete =
    session.latitude != null &&
    session.longitude != null &&
    session.radiusMeters != null &&
    session.maximumAcceptedAccuracy != null &&
    !!session.startsAt &&
    !!session.endsAt;

  return (
    <>
      <Dialog open onClose={requestClose} fullWidth maxWidth='lg' aria-labelledby='attendance-geo-title'>
        <DialogTitle id='attendance-geo-title'>Configuración de geolocalización</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <AttendanceSessionBadge session={session} />
            {!draft && (
              <Alert severity='info'>
                La ubicación, radio, precisión, fecha y horario están bloqueados desde la activación.
              </Alert>
            )}
            {session.state === 'OPEN' && <Alert severity='info'>En curso — todavía no afecta el cálculo final.</Alert>}
            {session.state === 'CLOSED' && <Alert severity='success'>Finalizada — asistencia consolidada.</Alert>}
            {session.state === 'CANCELLED' && (
              <Alert severity='info'>Sesión cancelada. Permanece en el historial y no afecta el cálculo.</Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <AttendanceMap
                  latitude={latitude}
                  longitude={longitude}
                  radiusMeters={Number(radius)}
                  disabled={disabled}
                  onLocationChange={(lat, lon) => {
                    locationRequest.current += 1;
                    setLocating(false);
                    setLatitude(lat);
                    setLongitude(lon);
                    setLocationAccuracy(null);
                  }}
                />
                <Typography variant='caption' color='text.secondary'>
                  {latitude === null || longitude === null
                    ? 'Selecciona un punto. El centro inicial del mapa no se guarda.'
                    : `Centro: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`}
                </Typography>
                {!disabled && (
                  <Button onClick={locate} disabled={locating}>
                    {locating ? 'Obteniendo ubicación…' : 'Usar mi ubicación actual'}
                  </Button>
                )}
                {locationAccuracy !== null && (
                  <Typography variant='caption' display='block'>
                    Precisión estimada de tu ubicación: {Math.round(locationAccuracy)} m. No modifica la precisión
                    máxima aceptada.
                  </Typography>
                )}
                {locationMessage && <Alert severity='warning'>{locationMessage}</Alert>}
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack spacing={2}>
                  <TextField
                    label='Radio (metros)'
                    type='number'
                    value={radius}
                    disabled={disabled}
                    onChange={(event) => setRadius(event.target.value)}
                    inputProps={{ min: 1, max: 2147483647, step: 1 }}
                  />
                  <Slider
                    aria-label='Radio en metros'
                    min={1}
                    max={500}
                    value={Math.min(500, Math.max(1, Number(radius) || 1))}
                    disabled={disabled}
                    onChange={(_, value) => setRadius(String(value))}
                    valueLabelDisplay='auto'
                  />
                  <TextField
                    label='Precisión máxima aceptada (metros)'
                    type='number'
                    value={accuracy}
                    disabled={disabled}
                    onChange={(event) => setAccuracy(event.target.value)}
                    inputProps={{ min: 1, max: 2147483647, step: 1 }}
                    helperText='Ubicaciones con una precisión peor a este valor deberán volver a intentarse.'
                  />
                  <Typography variant='body2'>
                    Horario de Bolivia · America/La_Paz (UTC−04:00). El inicio define la fecha académica.
                  </Typography>
                  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale='es'>
                    {[
                      { label: 'Inicio', value: start, set: setStart },
                      { label: 'Fin', value: end, set: setEnd },
                    ].map((field) => (
                      <DateTimePicker
                        key={field.label}
                        label={field.label}
                        value={field.value ? dayjs(field.value) : null}
                        disabled={disabled}
                        ampm={false}
                        inputFormat='DD/MM/YYYY HH:mm'
                        onChange={(value: Dayjs | null) =>
                          field.set(value?.isValid() ? value.format('YYYY-MM-DDTHH:mm') : '')
                        }
                        renderInput={(params) => <TextField {...params} fullWidth />}
                      />
                    ))}
                  </LocalizationProvider>
                  {dirty && (
                    <Typography role='status' color='warning.main'>
                      Cambios sin guardar. Guarda antes de activar.
                    </Typography>
                  )}
                  {validation && <Alert severity='error'>{validation}</Alert>}
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={requestClose} disabled={!!busy}>
            Volver a la planilla
          </Button>
          {!draft && (
            <Button
              disabled={!!busy}
              onClick={async () => {
                setBusy('refresh');

                try {
                  await onRefresh();
                } catch (error) {
                  snackbar.error(getAttendanceGeoErrorMessage(error));
                } finally {
                  setBusy(null);
                }
              }}
            >
              Actualizar estado
            </Button>
          )}
          {canUpdate && draft && (
            <>
              <Button variant='outlined' onClick={save} disabled={!!busy}>
                {busy === 'save' ? 'Guardando…' : 'Guardar configuración'}
              </Button>
              <Button
                onClick={() => setConfirmation('activate')}
                disabled={!!busy || dirty || !complete || !savedComplete}
              >
                Activar sesión
              </Button>
              <Button
                variant='contained'
                onClick={() => setConfirmation('openNow')}
                disabled={!!busy || dirty || !complete || !savedComplete}
              >
                Abrir ahora
              </Button>
            </>
          )}
          {canUpdate && session.state === 'OPEN' && (
            <Button color='warning' onClick={() => setConfirmation('close')} disabled={!!busy}>
              Cerrar sesión
            </Button>
          )}
          {canUpdate && (draft || session.state === 'SCHEDULED') && (
            <Button color='error' onClick={() => setConfirmation('cancel')} disabled={!!busy || dirty}>
              Cancelar sesión
            </Button>
          )}
          {busy && <CircularProgress size={20} aria-label='Procesando sesión' />}
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        fullWidth
        maxWidth='sm'
        aria-labelledby='attendance-geo-confirm-title'
      >
        <DialogTitle id='attendance-geo-confirm-title'>
          {confirmation === 'discard' ? 'Cambios sin guardar' : confirmation ? actionTitles[confirmation] : ''}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {confirmation === 'discard'
              ? 'Hay cambios de configuración que todavía no fueron guardados.'
              : confirmation === 'openNow'
                ? 'El inicio configurado será sustituido por la hora actual. La hora de finalización se mantendrá. La configuración quedará bloqueada.'
                : confirmation === 'activate'
                  ? 'Al activar la sesión, la ubicación, radio, precisión y horario quedarán bloqueados.'
                  : confirmation === 'close'
                    ? 'Se cerrará la sesión ahora. Ya no se recibirán check-ins y se consolidarán las ausencias pendientes.'
                    : 'La sesión quedará cancelada, no contará académicamente y permanecerá en el historial.'}
          </DialogContentText>
          {(confirmation === 'activate' || confirmation === 'openNow') && (
            <Typography sx={{ mt: 2 }}>
              Centro: {latitude?.toFixed(6)}, {longitude?.toFixed(6)} · Radio: {radius} m · Precisión máxima: {accuracy}{' '}
              m<br />
              Inicio: {start.replace('T', ' ')} · Fin: {end.replace('T', ' ')} · Bolivia
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmation(null)}>
            {confirmation === 'discard' ? 'Continuar editando' : 'Volver'}
          </Button>
          <Button
            variant='contained'
            onClick={() => {
              if (confirmation === 'discard') onClose();
              else if (confirmation) void perform(confirmation);
            }}
          >
            {confirmation === 'discard' ? 'Descartar cambios' : confirmation ? actionTitles[confirmation] : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
