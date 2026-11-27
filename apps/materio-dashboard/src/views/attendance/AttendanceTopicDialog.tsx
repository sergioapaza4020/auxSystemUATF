'use client';

import { useEffect, useRef, useState } from 'react';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';

import type { IAttendanceSession } from '@/interfaces/attendances/attendance.interface';
import { updateAttendanceSessionTopic } from '@/api/attendances.service';
import { useSnackbar } from '@/hooks/useSnackbar';
import { getAttendanceGeoErrorMessage } from '@/utils/attendance-geolocation';

export function AttendanceTopicDialog({
  session,
  onClose,
  onSaved,
}: {
  session: IAttendanceSession;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [topic, setTopic] = useState(session.topic ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  const snackbar = useSnackbar();

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);
  const invalid = [...topic.trim()].length > 255;

  const save = async () => {
    if (lock.current || invalid || session.state === 'CANCELLED') return;
    lock.current = true;
    setSaving(true);
    setError('');

    try {
      await updateAttendanceSessionTopic(
        session.idAttendanceSession,
        topic.trim().toLowerCase() === 'sin tema' ? null : topic.trim() || null,
      );
      if (!alive.current) return;
      snackbar.success('Tema de la clase guardado.');

      try {
        await onSaved();
      } catch {
        if (alive.current) snackbar.warning('El tema se guardó. Actualiza la sesión para consultarlo.');
      }

      if (alive.current) onClose();
    } catch (failure) {
      if (alive.current) setError(getAttendanceGeoErrorMessage(failure));
    } finally {
      lock.current = false;
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth='sm'
      onClose={saving ? undefined : onClose}
      aria-labelledby='attendance-topic-title'
    >
      <DialogTitle id='attendance-topic-title'>Tema de la clase · Sesión #{session.idAttendanceSession}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          label='Tema de la clase'
          placeholder='Ej.: Introducción a Git'
          helperText={
            invalid
              ? 'Máximo 255 caracteres.'
              : 'Opcional. Se utilizará en los informes académicos. Vacío elimina el tema.'
          }
          value={topic}
          error={invalid}
          disabled={saving || session.state === 'CANCELLED'}
          inputProps={{ maxLength: 255 }}
          onChange={(event) => setTopic(event.target.value)}
          sx={{ mt: 2 }}
        />
        {error && (
          <Alert severity='error' sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          Cancelar
        </Button>
        <Button variant='contained' disabled={saving || invalid || session.state === 'CANCELLED'} onClick={save}>
          {saving ? 'Guardando…' : 'Guardar tema'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
