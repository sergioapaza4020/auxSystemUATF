'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';

import type { IActivity } from '@/interfaces/activities/activity.interface';
import type { IActivityCreate, IActivityUpdate } from '@/api/activities.service';

import { ActivityForm, type IActivityFormData } from './ActivityForm';
import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';

interface ActivityFormDialogProps {
  open: boolean;
  saving: boolean;
  activity: IActivity | null;
  nextOrder: number;
  idGradeSchemeDetail: number;

  onClose: () => void;
  onCreate: (data: IActivityCreate) => Promise<unknown>;
  onUpdate: (idActivity: number, data: IActivityUpdate) => Promise<unknown>;
}

export function ActivityFormDialog({
  open,
  saving,
  activity,
  nextOrder,
  idGradeSchemeDetail,
  onClose,
  onCreate,
  onUpdate,
}: ActivityFormDialogProps) {
  const [formData, setFormData] = useState<IActivityFormData>({
    name: '',
    description: '',
    date: '',
    order: nextOrder,
  });

  useEffect(() => {
    if (!open) return;

    if (activity) {
      setFormData({
        name: activity.name,
        description: activity.description ?? '',
        date: activity.date,
        order: activity.order,
      });

      return;
    }

    setFormData({
      name: '',
      description: '',
      date: '',
      order: nextOrder,
    });
  }, [open, activity, nextOrder]);

  const handleFormChange = useCallback((data: IActivityFormData) => {
    setFormData(data);
  }, []);

  const isValid = !!formData.name.trim() && !!formData.date && formData.order >= 1;

  const handleSubmit = async () => {
    if (!isValid) return;

    if (activity) {
      await onUpdate(activity.idActivity, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        date: formData.date,
        order: formData.order,
      });
    } else {
      await onCreate({
        gradeSchemeDetailId: idGradeSchemeDetail,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        date: formData.date,
        order: formData.order,
      });
    }

    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth='sm'
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle sx={{ px: 6, pt: 5, pb: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant='h5' fontWeight={600}>
            {activity ? 'Editar actividad' : 'Nueva actividad'}
          </Typography>

          <Typography variant='body2' color='text.secondary'>
            {activity
              ? 'Actualiza la información de la actividad.'
              : 'Registra una nueva actividad para este componente de evaluación.'}
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent
        sx={{
          px: 6,
          pt: '16px !important',
          pb: 4,
        }}
      >
        <ActivityForm initialValue={activity} defaultOrder={nextOrder} onChange={handleFormChange} />
      </DialogContent>

      <DialogActions
        sx={{
          px: 6,
          py: 4,
          borderTop: 1,
          borderColor: 'divider',
          gap: 2,
        }}
      >
        <Button variant='outlined' color='inherit' onClick={onClose} disabled={saving}>
          Cancelar
        </Button>

        <Button variant='contained' onClick={handleSubmit} disabled={saving || !isValid}>
          {activity ? 'Guardar cambios' : 'Crear actividad'}
        </Button>
      </DialogActions>

      <LoadingOverlay open={saving} />
    </Dialog>
  );
}
