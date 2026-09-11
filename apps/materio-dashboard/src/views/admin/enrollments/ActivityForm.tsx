'use client';

import { useEffect, useState } from 'react';

import { Stack, TextField } from '@mui/material';

import type { IActivity } from '@/interfaces/activities/activity.interface';

export interface IActivityFormData {
  name: string;
  description: string;
  date: string;
  order: number;
}

interface ActivityFormProps {
  initialValue?: IActivity | null;
  onChange: (data: IActivityFormData) => void;
}

export function ActivityForm({ initialValue, onChange }: ActivityFormProps) {
  const [name, setName] = useState(initialValue?.name ?? '');

  const [description, setDescription] = useState(initialValue?.description ?? '');

  const [date, setDate] = useState(initialValue?.date ?? '');

  const [order, setOrder] = useState(initialValue?.order ?? 1);

  useEffect(() => {
    setName(initialValue?.name ?? '');
    setDescription(initialValue?.description ?? '');
    setDate(initialValue?.date ?? '');
    setOrder(initialValue?.order ?? 1);
  }, [initialValue]);

  useEffect(() => {
    onChange({
      name,
      description,
      date,
      order,
    });
  }, [name, description, date, order, onChange]);

  return (
    <Stack spacing={3}>
      <TextField
        fullWidth
        label='Nombre de la actividad'
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />

      <TextField
        fullWidth
        label='Descripción'
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        multiline
        rows={3}
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          fullWidth
          label='Fecha'
          type='date'
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />

        <TextField
          fullWidth
          label='Orden'
          type='number'
          value={order}
          onChange={(event) => setOrder(Number(event.target.value))}
          inputProps={{
            min: 1,
          }}
          required
        />
      </Stack>
    </Stack>
  );
}
