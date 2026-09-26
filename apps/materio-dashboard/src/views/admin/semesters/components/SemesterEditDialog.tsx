'use client';

import { useState } from 'react';

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

import Form from '@/components/Form';
import type { ISemester, ISemesterWrite } from '@/interfaces/semesters/semester.interface';
import { semesterDateError, toLocalDateTime, toSemesterDate } from '../semester-dates';

interface Props {
  semester: ISemester | null;
  records: ISemester[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (value: ISemesterWrite) => Promise<void>;
}

export function SemesterEditDialog({ semester, records, busy, error, onClose, onSubmit }: Props) {
  const [year, setYear] = useState(String(semester?.year ?? new Date().getFullYear()));
  const [period, setPeriod] = useState<ISemester['period']>(semester?.period ?? 'I');
  const [start, setStart] = useState(semester ? toLocalDateTime(semester.startDate) : '');
  const [end, setEnd] = useState(semester ? toLocalDateTime(semester.endDate) : '');
  const [touched, setTouched] = useState(false);
  const yearError = !/^\d{4}$/.test(year) || Number(year) < 1 ? 'Introduce un año de cuatro dígitos.' : '';
  const dateError = semesterDateError(start, end);

  const duplicate = records.some(
    (record) => record.idSemester !== semester?.idSemester && record.year === Number(year) && record.period === period,
  );

  const valid = !yearError && !dateError && !duplicate;

  const overlaps =
    !!start &&
    !!end &&
    records.some(
      (record) =>
        record.idSemester !== semester?.idSemester &&
        record.isActive &&
        new Date(record.startDate).getTime() <= new Date(end).getTime() &&
        new Date(record.endDate).getTime() >= new Date(start).getTime(),
    );

  return (
    <Dialog
      open
      fullWidth
      maxWidth='sm'
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby='semester-dialog-title'
    >
      <DialogTitle id='semester-dialog-title'>{semester ? 'Editar semestre' : 'Crear semestre'}</DialogTitle>
      <DialogContent>
        <Form
          id='semester-form'
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!busy && valid)
              void onSubmit({
                year: Number(year),
                period,
                startDate: toSemesterDate(start, semester?.startDate),
                endDate: toSemesterDate(end, semester?.endDate),
              });
          }}
        >
          <Stack spacing={3} sx={{ pt: 2 }}>
            {error && <Alert severity='error'>{error}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                fullWidth
                label='Período'
                value={period}
                disabled={busy}
                onChange={(event) => setPeriod(event.target.value as ISemester['period'])}
              >
                <MenuItem value='I'>I</MenuItem>
                <MenuItem value='II'>II</MenuItem>
              </TextField>
              <TextField
                autoFocus
                fullWidth
                required
                label='Año'
                type='number'
                value={year}
                disabled={busy}
                onChange={(event) => setYear(event.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && !!yearError}
                helperText={touched && yearError}
                inputProps={{ min: 1, max: 9999, step: 1 }}
              />
            </Stack>
            {duplicate && (
              <Alert severity='error'>
                Este período y año ya existen. Si el semestre está inactivo, reactívalo desde la tabla.
              </Alert>
            )}
            <TextField
              required
              fullWidth
              label='Fecha y hora de inicio'
              type='datetime-local'
              value={start}
              disabled={busy}
              onChange={(event) => setStart(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 1 }}
            />
            <TextField
              required
              fullWidth
              label='Fecha y hora de fin'
              type='datetime-local'
              value={end}
              disabled={busy}
              onChange={(event) => setEnd(event.target.value)}
              onBlur={() => setTouched(true)}
              error={(touched || (!!start && !!end)) && !!dateError}
              helperText={(touched || (!!start && !!end)) && dateError}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 1 }}
            />
            <Typography variant='body2' color='text.secondary'>
              Fechas y horas en tu zona local. El semestre es «Actual» cuando el sistema lo identifica dentro de su
              vigencia; estar activo por sí solo no lo hace actual.
            </Typography>
            {overlaps && (
              <Alert severity='warning'>
                Las fechas coinciden con otro semestre activo. Revisa la vigencia: el sistema devuelve un solo semestre
                actual.
              </Alert>
            )}
          </Stack>
        </Form>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant='contained' type='submit' form='semester-form' disabled={busy || !valid}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
