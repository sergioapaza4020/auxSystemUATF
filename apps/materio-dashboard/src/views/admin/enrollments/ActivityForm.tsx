'use client';

import { useEffect, useState } from 'react';

import { Grid, TextField } from '@mui/material';

import type { IActivity } from '@/interfaces/activities/activity.interface';
import { DateField } from '@/components/DateField';

export interface IActivityFormData {
  name: string;
  description: string;
  dueDate: string;
}

interface ActivityFormProps {
  initialValue?: IActivity | null;
  onChange: (data: IActivityFormData) => void;
}

export function ActivityForm({ initialValue, onChange }: ActivityFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [dueDate, setDueDate] = useState(initialValue?.dueDate ?? '');

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
    setDueDate(initialValue?.dueDate ?? '');
  }, [initialValue]);

  useEffect(() => {
    onChange({
      name,
      description,
      dueDate,
    });
  }, [name, description, dueDate, onChange]);

  return (
    <Grid container spacing={4}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          required
          autoFocus
          label='Nombre de la actividad'
          placeholder='Ej. Práctica de laboratorio'
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Grid>

      <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          minRows={3}
          maxRows={5}
          label='Descripción'
          placeholder='Describe brevemente la actividad (opcional)'
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Grid>

      <Grid item xs={12}>
        <DateField fullWidth required label='Fecha de entrega' value={dueDate} onChange={setDueDate} />
      </Grid>
    </Grid>
  );
}
