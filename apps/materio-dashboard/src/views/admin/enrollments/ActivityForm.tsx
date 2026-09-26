'use client';

import { useEffect, useState } from 'react';

import { Grid, TextField } from '@mui/material';

import type { IActivity } from '@/interfaces/activities/activity.interface';

export interface IActivityFormData {
  name: string;
  description: string;
  date: string;
  order: number;
}

interface ActivityFormProps {
  initialValue?: IActivity | null;
  defaultOrder?: number;
  onChange: (data: IActivityFormData) => void;
}

export function ActivityForm({ initialValue, defaultOrder = 1, onChange }: ActivityFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');
  const [description, setDescription] = useState(initialValue?.description ?? '');
  const [date, setDate] = useState(initialValue?.date ?? '');
  const [order, setOrder] = useState(initialValue?.order ?? defaultOrder);

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
    setDate(initialValue?.date ?? '');
    setOrder(initialValue?.order ?? defaultOrder);
  }, [initialValue, defaultOrder]);

  useEffect(() => {
    onChange({
      name,
      description,
      date,
      order,
    });
  }, [name, description, date, order, onChange]);

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

      <Grid item xs={12} sm={8}>
        <TextField
          fullWidth
          required
          label='Fecha'
          type='date'
          value={date}
          onChange={(event) => setDate(event.target.value)}
          InputLabelProps={{
            shrink: true,
          }}
        />
      </Grid>

      <Grid item xs={12} sm={4}>
        <TextField
          fullWidth
          required
          label='Orden'
          type='number'
          value={order}
          onChange={(event) => {
            const value = Number(event.target.value);

            setOrder(value);
          }}
          inputProps={{
            min: 1,
          }}
        />
      </Grid>
    </Grid>
  );
}
