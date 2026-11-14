'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import {
  activateSession,
  openSessionNow,
  closeSession,
  cancelSession,
  configureAttendanceQr,
} from '@/api/attendances.service';
import type { IAttendanceSession, IAttendanceLifecycle } from '@/interfaces/attendances/attendance.interface';
import { attendanceInstant, attendanceLocalTime } from '@/utils/attendance-geolocation';
import { attendanceQrError } from '@/utils/attendance-qr';
import { useSnackbar } from '@/hooks/useSnackbar';
import { AttendanceSessionBadge } from './AttendanceSessionBadge';
import { AttendanceQrPresentationDialog } from './AttendanceQrPresentationDialog';

type Action = 'activate' | 'openNow' | 'close' | 'cancel' | 'delete';

const titles: Record<Action, string> = {
  activate: 'Activar sesión',
  openNow: 'Abrir ahora',
  close: 'Cerrar sesión',
  cancel: 'Cancelar sesión',
  delete: 'Eliminar borrador',
};

const success: Record<Action, string> = {
  activate: 'Sesión activada.',
  openNow: 'Sesión abierta.',
  close: 'Sesión cerrada.',
  cancel: 'Sesión cancelada.',
  delete: 'Borrador eliminado.',
};

const actions = { activate: activateSession, openNow: openSessionNow, close: closeSession, cancel: cancelSession };

export function AttendanceQrConfigDialog({
  session,
  course,
  canUpdate,
  canGetQr,
  canDelete,
  initialPresentation = false,
  onClose,
  onRefresh,
  onDelete,
}: {
  session: IAttendanceSession;
  course: string;
  canUpdate: boolean;
  canGetQr: boolean;
  canDelete: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onDelete: () => Promise<void>;
  initialPresentation?: boolean;
}) {
  const [current, setCurrent] = useState(session);
  const [start, setStart] = useState(attendanceLocalTime(session.startsAt));
  const [end, setEnd] = useState(attendanceLocalTime(session.endsAt));
  const [baseline, setBaseline] = useState(JSON.stringify([start, end]));
  const [busy, setBusy] = useState<Action | 'save' | 'refresh' | null>(null);
  const [confirmation, setConfirmation] = useState<Action | 'discard' | null>(null);
  const [validation, setValidation] = useState('');
  const [presentation, setPresentation] = useState(initialPresentation && session.state === 'OPEN');
  const lock = useRef(false);
  const alive = useRef(true);
  const refresh = useRef(onRefresh);

  refresh.current = onRefresh;
  const snackbar = useSnackbar();
  const draft = current.state === 'DRAFT';
  const dirty = draft && baseline !== JSON.stringify([start, end]);
  const startsAt = attendanceInstant(start);
  const endsAt = attendanceInstant(end);
  const complete = !!startsAt && !!endsAt && endsAt > startsAt;

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setCurrent(session);

    if (session.state !== 'DRAFT') {
      setStart(attendanceLocalTime(session.startsAt));
      setEnd(attendanceLocalTime(session.endsAt));
    }
  }, [session]);
  useEffect(() => {
    if (!dirty) return;

    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', leave);

    return () => window.removeEventListener('beforeunload', leave);
  }, [dirty]);
  useEffect(() => {
    const instant = current.state === 'SCHEDULED' ? current.startsAt : current.state === 'OPEN' ? current.endsAt : null;

    if (!instant) return;
    let active = true;
    let pending = false;
    let timer: ReturnType<typeof setTimeout>;

    const check = async () => {
      if (!active || pending || document.visibilityState === 'hidden') return;
      pending = true;

      try {
        await refresh.current();
      } catch {
        if (active) setValidation('Actualiza la sesión para consultar su estado.');
      } finally {
        pending = false;
      }
    };

    const schedule = () => {
      const untilBoundary = Date.parse(instant) - Date.now() + 100;
      const delay = untilBoundary > 0 ? Math.min(60000, untilBoundary) : 30000;

      timer = setTimeout(async () => {
        await check();
        if (active) schedule();
      }, delay);
    };

    const regainFocus = () => {
      void check();
    };

    schedule();
    window.addEventListener('focus', regainFocus);
    document.addEventListener('visibilitychange', regainFocus);

    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener('focus', regainFocus);
      document.removeEventListener('visibilitychange', regainFocus);
    };
  }, [current.state, current.startsAt, current.endsAt]);

  const apply = (data: IAttendanceLifecycle | undefined) => {
    if (data && alive.current) setCurrent((old) => ({ ...old, ...data }));
  };

  const save = async () => {
    if (lock.current || !draft || !canUpdate) return;

    if (!complete) {
      setValidation('Completa inicio y fin válidos; el fin debe ser posterior al inicio.');

      return;
    }

    lock.current = true;
    setBusy('save');
    setValidation('');

    try {
      apply(await configureAttendanceQr(current.idAttendanceSession, { startsAt: startsAt!, endsAt: endsAt! }));
      if (!alive.current) return;
      setBaseline(JSON.stringify([start, end]));
      snackbar.success('Configuración QR guardada correctamente.');
      await onRefresh().catch(() => snackbar.warning('Configuración guardada. Actualiza el detalle y el historial.'));
    } catch (error) {
      if (alive.current) setValidation(attendanceQrError(error));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const perform = async (action: Action) => {
    if (lock.current || (action === 'delete' ? !canDelete : !canUpdate)) return;
    lock.current = true;
    setBusy(action);
    setConfirmation(null);
    setValidation('');
    setPresentation(false);

    try {
      if (action === 'delete') {
        await onDelete();
        if (alive.current) onClose();
      } else {
        apply(await actions[action](current.idAttendanceSession));

        try {
          await onRefresh();
        } catch {
          if (alive.current)
            snackbar.warning('La operación se guardó. Actualiza para consultar el detalle y el historial.');
        }
      }

      if (alive.current) snackbar.success(success[action]);
    } catch (error) {
      if (alive.current) setValidation(attendanceQrError(error));
      await onRefresh().catch(() => undefined);
    } finally {
      lock.current = false;
      if (alive.current) setBusy(null);
    }
  };

  const requestClose = () => {
    if (!lock.current) {
      if (dirty) setConfirmation('discard');
      else onClose();
    }
  };

  return (
    <>
      <Dialog open onClose={requestClose} fullWidth maxWidth='sm' aria-labelledby='qr-config-title'>
        <DialogTitle id='qr-config-title'>Configuración de código QR</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <AttendanceSessionBadge session={current} />
            <Typography>{course}</Typography>
            <Typography variant='body2'>Horario de Bolivia · America/La_Paz</Typography>
            <TextField
              label='Inicio'
              type='datetime-local'
              value={start}
              onChange={(event) => setStart(event.target.value)}
              disabled={!draft || !canUpdate || !!busy}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label='Finalización'
              type='datetime-local'
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              disabled={!draft || !canUpdate || !!busy}
              InputLabelProps={{ shrink: true }}
            />
            {validation && <Alert severity='warning'>{validation}</Alert>}
            {current.state === 'OPEN' && <Alert severity='info'>En curso — todavía no afecta el cálculo final.</Alert>}
            {current.state === 'CLOSED' && <Alert severity='success'>Finalizada — asistencia consolidada.</Alert>}
            {current.state === 'CANCELLED' && <Alert severity='info'>Sesión cancelada. Solo lectura.</Alert>}
            {current.state === 'SCHEDULED' && (
              <Alert severity='info'>
                Sesión programada. El QR estará disponible cuando el servidor confirme su apertura.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={requestClose} disabled={!!busy}>
            Cerrar configuración
          </Button>
          <Button
            disabled={!!busy}
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy('refresh');

              try {
                await onRefresh();
              } catch {
                setValidation('No se pudo actualizar la sesión.');
              } finally {
                lock.current = false;
                if (alive.current) setBusy(null);
              }
            }}
          >
            Actualizar
          </Button>
          {draft && canUpdate && (
            <>
              <Button onClick={save} disabled={!!busy}>
                Guardar configuración
              </Button>
              <Button
                onClick={() => setConfirmation('activate')}
                disabled={!!busy || dirty || !current.startsAt || !current.endsAt}
              >
                Activar sesión
              </Button>
              <Button onClick={() => setConfirmation('openNow')} disabled={!!busy || dirty || !current.endsAt}>
                Abrir ahora
              </Button>
            </>
          )}
          {(draft || current.state === 'SCHEDULED') && canUpdate && (
            <Button color='warning' onClick={() => setConfirmation('cancel')} disabled={!!busy}>
              Cancelar sesión
            </Button>
          )}
          {draft && canDelete && current.presentCount + current.excusedCount + current.absentCount === 0 && (
            <Button color='error' disabled={!!busy} onClick={() => setConfirmation('delete')}>
              Eliminar borrador
            </Button>
          )}
          {current.state === 'OPEN' && canGetQr && (
            <Button variant='contained' disabled={!!busy} onClick={() => setPresentation(true)}>
              Mostrar QR
            </Button>
          )}
          {current.state === 'OPEN' && canUpdate && (
            <Button color='warning' disabled={!!busy} onClick={() => setConfirmation('close')}>
              Cerrar sesión
            </Button>
          )}
        </DialogActions>
      </Dialog>
      <Dialog
        open={!!confirmation}
        onClose={() => setConfirmation(null)}
        maxWidth='xs'
        fullWidth
        aria-labelledby='qr-confirm-title'
      >
        <DialogTitle id='qr-confirm-title'>
          {confirmation === 'discard' ? 'Descartar cambios' : confirmation ? titles[confirmation] : ''}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {confirmation === 'activate'
              ? 'Al activar, el horario y la configuración quedarán bloqueados.'
              : confirmation === 'openNow'
                ? 'El inicio se establecerá con la hora actual del servidor y se mantendrá la hora de finalización.'
                : confirmation === 'discard'
                  ? 'Se perderán los cambios de horario sin guardar.'
                  : 'Confirma esta operación sobre la sesión.'}
          </Typography>
          <Typography variant='body2'>
            Inicio: {start.replace('T', ' ')} · Fin: {end.replace('T', ' ')} (Bolivia)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmation(null)}>Volver</Button>
          <Button
            variant='contained'
            onClick={() => {
              if (confirmation === 'discard') onClose();
              else if (confirmation) void perform(confirmation);
            }}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
      {presentation && current.state === 'OPEN' && session.state === 'OPEN' && (
        <AttendanceQrPresentationDialog
          key={current.idAttendanceSession}
          session={current}
          course={course}
          onClose={() => setPresentation(false)}
          onUnavailable={() => {
            setPresentation(false);
            void onRefresh().catch(() => undefined);
          }}
        />
      )}
    </>
  );
}
