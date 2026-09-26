'use client';

import { useState } from 'react';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';

import Form from '@/components/Form';
import type { IGradeItem, IGradeItemWrite } from '@/interfaces/grade-items/grade-item.interface';
import { gradeItemNameError } from '../grade-item-rules';

interface Props {
  item: IGradeItem | null;
  records: IGradeItem[];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (value: IGradeItemWrite) => Promise<void>;
}

export function GradeItemEditDialog({ item, records, busy, error, onClose, onSubmit }: Props) {
  const [name, setName] = useState(item?.name ?? '');
  const [touched, setTouched] = useState(false);
  const validationError = gradeItemNameError(name, records, item);

  return (
    <Dialog
      open
      fullWidth
      maxWidth='sm'
      onClose={() => {
        if (!busy) onClose();
      }}
      aria-labelledby='grade-item-dialog-title'
    >
      <DialogTitle id='grade-item-dialog-title'>
        {item ? 'Editar ítem de calificación' : 'Crear ítem de calificación'}
      </DialogTitle>
      <DialogContent>
        <Form
          id='grade-item-form'
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!busy && !validationError) void onSubmit({ name: name.trim() });
          }}
        >
          <Stack spacing={3} sx={{ pt: 2 }}>
            {error && <Alert severity='error'>{error}</Alert>}
            <TextField
              autoFocus
              fullWidth
              required
              label='Nombre'
              value={name}
              disabled={busy}
              onBlur={() => setTouched(true)}
              onChange={(event) => setName(event.target.value)}
              error={touched && !!validationError}
              helperText={touched ? validationError : 'Ejemplo: Exámenes, Prácticas o Proyectos.'}
            />
          </Stack>
        </Form>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant='contained' type='submit' form='grade-item-form' disabled={busy || !!validationError}>
          {busy ? 'Guardando…' : 'Guardar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
