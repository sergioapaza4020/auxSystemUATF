import { useState } from 'react';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';

import type { AttendanceSessionMode } from '@/interfaces/attendances/attendance.interface';
import { DateField } from '@/components/DateField';
import { attendanceToday } from '@/utils/attendance-time';

export function AttendanceCreateDialog({
  onClose,
  onCreate,
  initialDate,
  creating = false,
}: {
  onClose: () => void;
  onCreate: (mode: AttendanceSessionMode, date?: string) => void;
  initialDate: string;
  creating?: boolean;
}) {
  const [mode, setMode] = useState<AttendanceSessionMode>('GEOLOCATION_QR');
  const [date, setDate] = useState(initialDate);

  const today = attendanceToday();
  const past = !!date && date < today;

  return (
    <Dialog
      open
      onClose={creating ? undefined : onClose}
      fullWidth
      maxWidth='xs'
      aria-labelledby='attendance-create-title'
    >
      <DialogTitle id='attendance-create-title'>Nueva sesión</DialogTitle>
      <DialogContent>
        <RadioGroup
          aria-label='Tipo de registro'
          value={mode}
          onChange={(_, value) =>
            setMode(
              value === 'GEOLOCATION_QR'
                ? 'GEOLOCATION_QR'
                : value === 'QR'
                  ? 'QR'
                  : value === 'GEOLOCATION'
                    ? 'GEOLOCATION'
                    : 'MANUAL',
            )
          }
        >
          <FormControlLabel
            value='GEOLOCATION_QR'
            control={<Radio disabled={creating} />}
            label='QR + ubicación (recomendado)'
          />
          <FormControlLabel value='MANUAL' control={<Radio disabled={creating} />} label='Manual' />
          <FormControlLabel value='GEOLOCATION' control={<Radio disabled={creating} />} label='Geolocalización' />
          <FormControlLabel value='QR' control={<Radio disabled={creating} />} label='Código QR' />
        </RadioGroup>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          {mode === 'GEOLOCATION_QR'
            ? 'Los estudiantes escanean un código QR dinámico y validan su ubicación para registrar asistencia.'
            : mode === 'QR'
              ? 'Los estudiantes registran asistencia mediante un código QR temporal.'
              : mode === 'GEOLOCATION'
                ? 'Los estudiantes registran su asistencia mediante su ubicación.'
                : 'El auxiliar registra directamente la asistencia.'}
        </Typography>
        <DateField
          fullWidth
          label='Fecha'
          disabled={creating}
          value={date}
          minDate={today}
          error={past}
          onChange={setDate}
          helperText={
            past
              ? 'No puedes crear una sesión de asistencia con una fecha anterior a hoy.'
              : mode !== 'MANUAL'
                ? 'Fecha inicial del borrador. Al configurar el horario, el inicio definirá la fecha.'
                : undefined
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={creating}>
          Cancelar
        </Button>
        <Button
          variant='contained'
          disabled={!date || past || creating}
          onClick={() => {
            if (date && date >= attendanceToday()) onCreate(mode, date);
          }}
        >
          {creating ? 'Creando sesión…' : 'Crear sesión'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
