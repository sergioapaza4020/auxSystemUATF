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

export function AttendanceCreateDialog({
  onClose,
  onCreate,
  initialDate,
}: {
  onClose: () => void;
  onCreate: (mode: AttendanceSessionMode, date?: string) => void;
  initialDate: string;
}) {
  const [mode, setMode] = useState<AttendanceSessionMode>('MANUAL');
  const [date, setDate] = useState(initialDate);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='xs' aria-labelledby='attendance-create-title'>
      <DialogTitle id='attendance-create-title'>Nueva sesión</DialogTitle>
      <DialogContent>
        <RadioGroup
          aria-label='Tipo de registro'
          value={mode}
          onChange={(_, value) => setMode(value === 'QR' ? 'QR' : value === 'GEOLOCATION' ? 'GEOLOCATION' : 'MANUAL')}
        >
          <FormControlLabel value='MANUAL' control={<Radio />} label='Manual' />
          <FormControlLabel value='GEOLOCATION' control={<Radio />} label='Geolocalización' />
          <FormControlLabel value='QR' control={<Radio />} label='Código QR' />
        </RadioGroup>
        <Typography variant='body2' color='text.secondary'>
          {mode === 'QR'
            ? 'Los estudiantes escanean un código temporal para registrar su asistencia.'
            : mode === 'GEOLOCATION'
              ? 'El estudiante registra asistencia mediante su ubicación.'
              : 'El auxiliar registra la asistencia.'}
        </Typography>
        <DateField
          fullWidth
          label='Fecha'
          value={date}
          onChange={setDate}
          helperText={
            mode !== 'MANUAL'
              ? 'Fecha inicial del borrador. Al configurar el horario, el inicio definirá la fecha.'
              : undefined
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant='contained' disabled={!date} onClick={() => onCreate(mode, date)}>
          Crear sesión
        </Button>
      </DialogActions>
    </Dialog>
  );
}
