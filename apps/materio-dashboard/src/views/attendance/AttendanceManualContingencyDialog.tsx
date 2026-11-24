'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { getAttendanceSession, saveAttendances } from '@/api/attendances.service';
import type { IAttendance, IAttendanceSession } from '@/interfaces/attendances/attendance.interface';
import type { IEnrollmentStudent } from '@/interfaces/enrollments/enrollment-student.interface';
import { AttendanceStatus } from '@/enums/attendanceStatus';
import { useSnackbar } from '@/hooks/useSnackbar';
import {
  combinedAttendanceError,
  isProtectedAttendance,
  manualReasonError,
  mayHaveSavedAttendance,
  normalizeManualReason,
} from '@/utils/attendance-combined';

export function AttendanceManualContingencyDialog({
  session,
  student,
  existing,
  onClose,
  onSaved,
}: {
  session: IAttendanceSession;
  student: IEnrollmentStudent;
  existing?: IAttendance;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [status, setStatus] = useState(existing?.status ?? AttendanceStatus.PRESENT);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const read = useRef<AbortController | null>(null);
  const snackbar = useSnackbar();
  const validation = manualReasonError(reason);

  const editable =
    session.mode === 'GEOLOCATION_QR' &&
    (session.state === 'OPEN' || session.state === 'CLOSED') &&
    !isProtectedAttendance(existing?.registrationMethod);

  const sameReason = !!existing && normalizeManualReason(reason) === normalizeManualReason(existing.observation ?? '');

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
      read.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!reason && !uncertain) return;

    const leave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', leave);

    return () => window.removeEventListener('beforeunload', leave);
  }, [reason, uncertain]);

  const completed = async () => {
    if (!alive.current) return;
    snackbar.success('Contingencia guardada y auditada.');

    try {
      await onSaved();
    } catch {
      if (alive.current) snackbar.warning('La marca se guardó. Actualiza la planilla para consultarla.');
    }

    if (alive.current) onClose();
  };

  const submit = async () => {
    if (lock.current || uncertain || !editable || validation || sameReason || !confirming) return;
    lock.current = true;
    setBusy(true);
    setError('');

    try {
      await saveAttendances(session.idAttendanceSession, {
        attendances: [{ enrollmentId: student.idEnrollment, status, observation: normalizeManualReason(reason) }],
      });
      await completed();
    } catch (failure) {
      if (!alive.current) return;
      setError(combinedAttendanceError(failure));
      setUncertain(mayHaveSavedAttendance(failure));
      snackbar.error(combinedAttendanceError(failure));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const reconcile = async () => {
    if (lock.current || !uncertain) return;
    lock.current = true;
    setBusy(true);
    const controller = new AbortController();

    read.current = controller;

    try {
      const current = await getAttendanceSession(session.idAttendanceSession, undefined, controller.signal);

      if (!alive.current || controller.signal.aborted) return;
      const mark = current.attendances.find((item) => item.enrollment.idEnrollment === student.idEnrollment);

      if (
        mark?.registrationMethod === 'MANUAL' &&
        mark.status === status &&
        normalizeManualReason(mark.observation ?? '') === normalizeManualReason(reason)
      )
        await completed();
      else
        setError(
          'No se confirmó esta contingencia. El motivo se conserva y no se repetirá el envío. Vuelve a consultar el resultado o revisa la planilla antes de iniciar otra operación.',
        );
    } catch (failure) {
      if (alive.current && !controller.signal.aborted) setError(combinedAttendanceError(failure));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth='sm'
      onClose={busy || uncertain ? undefined : onClose}
      aria-labelledby='manual-contingency-title'
    >
      <DialogTitle id='manual-contingency-title'>
        {existing ? 'Corregir contingencia manual' : 'Registrar contingencia manual'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography>
            {student.user.name} {student.user.lastname} · Matrícula #{student.idEnrollment}
          </Typography>
          <Typography>
            Sesión #{session.idAttendanceSession} · {session.date.slice(0, 10)}
          </Typography>
          {existing && (
            <Alert severity='info'>
              Estado actual: {existing.status}. Motivo anterior: {existing.observation || 'Sin motivo'}. El servidor
              verificará si esta marca admite una corrección auditada.
            </Alert>
          )}
          {!editable && <Alert severity='warning'>Esta marca o sesión no admite contingencias.</Alert>}
          <TextField
            select
            label='Nuevo estado'
            value={status}
            disabled={busy || uncertain || confirming || !editable}
            onChange={(event) => {
              const next = event.target.value;

              if (
                next === AttendanceStatus.PRESENT ||
                next === AttendanceStatus.EXCUSED ||
                next === AttendanceStatus.ABSENT
              )
                setStatus(next);
            }}
          >
            <MenuItem value={AttendanceStatus.PRESENT}>Presente</MenuItem>
            <MenuItem value={AttendanceStatus.EXCUSED}>Con permiso</MenuItem>
            <MenuItem value={AttendanceStatus.ABSENT}>Ausente explícito</MenuItem>
          </TextField>
          <TextField
            multiline
            minRows={3}
            label={existing ? 'Nuevo motivo' : 'Motivo de la contingencia'}
            value={reason}
            disabled={busy || uncertain || confirming || !editable}
            onChange={(event) => setReason(event.target.value)}
            error={!!reason && (!!validation || sameReason)}
            helperText={
              sameReason
                ? 'Escribe un motivo nuevo para la corrección.'
                : validation || `${reason.length}/500 caracteres`
            }
          />
          <Typography variant='caption'>
            Describe la situación real, por ejemplo: el estudiante no dispone de teléfono; no fue posible obtener GPS;
            incidencia de conectividad verificada en aula. No se requiere evidencia QR o GPS inexistente.
          </Typography>
          {confirming && (
            <Alert severity='warning'>
              Confirma la contingencia de este estudiante: {status}. Motivo: {normalizeManualReason(reason)}. La
              operación, el actor y la hora quedarán auditados.
            </Alert>
          )}
          {error && <Alert severity='error'>{error}</Alert>}
          {uncertain && (
            <Alert severity='warning'>
              Se perdió la confirmación. No vuelvas a enviar la marca; consulta el resultado. Se conserva el motivo
              escrito.
            </Alert>
          )}
          {leaving && (
            <Alert severity='warning'>
              El resultado sigue sin confirmarse. Al cerrar se descartará este texto local. Conserva el motivo y revisa
              la planilla y el historial antes de registrar otra contingencia.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy || uncertain} onClick={onClose}>
          Volver
        </Button>
        {uncertain ? (
          <>
            <Button
              disabled={busy}
              onClick={() => {
                if (leaving) onClose();
                else setLeaving(true);
              }}
            >
              {leaving ? 'Confirmar cierre sin reenviar' : 'Cerrar sin reenviar'}
            </Button>
            <Button disabled={busy} onClick={reconcile}>
              Consultar resultado
            </Button>
          </>
        ) : confirming ? (
          <>
            <Button disabled={busy} onClick={() => setConfirming(false)}>
              Revisar
            </Button>
            <Button variant='contained' disabled={busy || !editable || !!validation || sameReason} onClick={submit}>
              {busy ? 'Guardando…' : 'Confirmar contingencia'}
            </Button>
          </>
        ) : (
          <Button
            variant='contained'
            disabled={!editable || !!validation || sameReason}
            onClick={() => setConfirming(true)}
          >
            Revisar contingencia
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
