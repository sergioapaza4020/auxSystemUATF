'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

import type { IActivity } from '@/interfaces/activities/activity.interface';
import type { IActivityCreate, IActivityUpdate } from '@/api/activities.service';

import { ActivityForm, type IActivityFormData } from './ActivityForm';

interface ActivityManagementDialogProps {
  open: boolean;
  loading: boolean;
  saving: boolean;
  activities: IActivity[];
  gradeItemName: string;
  idGradeSchemeDetail: number;
  onClose: () => void;
  onCreate: (data: IActivityCreate) => Promise<unknown>;
  onUpdate: (idActivity: number, data: IActivityUpdate) => Promise<unknown>;
  onDelete: (idActivity: number) => Promise<unknown>;
}

export function ActivityManagementDialog({
  open,
  loading,
  saving,
  activities,
  gradeItemName,
  idGradeSchemeDetail,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: ActivityManagementDialogProps) {
  const [formOpen, setFormOpen] = useState(false);

  const [editingActivity, setEditingActivity] = useState<IActivity | null>(null);

  const [formData, setFormData] = useState<IActivityFormData>({
    name: '',
    description: '',
    date: '',
    order: 1,
  });

  const sortedActivities = useMemo(() => [...activities].sort((a, b) => a.order - b.order), [activities]);

  const handleFormChange = useCallback((data: IActivityFormData) => {
    setFormData(data);
  }, []);

  const handleCreate = () => {
    setEditingActivity(null);

    setFormData({
      name: '',
      description: '',
      date: '',
      order: activities.length > 0 ? Math.max(...activities.map((activity) => activity.order)) + 1 : 1,
    });

    setFormOpen(true);
  };

  const handleEdit = (activity: IActivity) => {
    setEditingActivity(activity);
    setFormData({
      name: activity.name,
      description: activity.description ?? '',
      date: activity.date,
      order: activity.order,
    });

    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.date || formData.order < 1) {
      return;
    }

    if (editingActivity) {
      await onUpdate(editingActivity.idActivity, {
        name: formData.name,
        description: formData.description || undefined,
        date: formData.date,
        order: formData.order,
      });
    } else {
      await onCreate({
        gradeSchemeDetailId: idGradeSchemeDetail,
        name: formData.name,
        description: formData.description || undefined,
        date: formData.date,
        order: formData.order,
      });
    }

    setFormOpen(false);
    setEditingActivity(null);
  };

  const handleDelete = async (activity: IActivity) => {
    await onDelete(activity.idActivity);
  };

  return (
    <>
      <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth='md'>
        <DialogTitle>Actividades — {gradeItemName}</DialogTitle>

        <DialogContent>
          {loading ? (
            <Stack alignItems='center' py={4}>
              <CircularProgress />
            </Stack>
          ) : (
            <Stack spacing={2}>
              {sortedActivities.length === 0 ? (
                <Typography color='text.secondary'>Este componente todavía no tiene actividades.</Typography>
              ) : (
                sortedActivities.map((activity) => (
                  <Stack key={activity.idActivity} spacing={1}>
                    <Stack direction='row' justifyContent='space-between' alignItems='flex-start'>
                      <Stack spacing={0.5}>
                        <Typography fontWeight={600}>
                          {activity.order}. {activity.name}
                        </Typography>

                        {activity.description && (
                          <Typography variant='body2' color='text.secondary'>
                            {activity.description}
                          </Typography>
                        )}

                        <Typography variant='body2' color='text.secondary'>
                          Fecha: {activity.date}
                        </Typography>
                      </Stack>

                      <Stack direction='row'>
                        <IconButton onClick={() => handleEdit(activity)} disabled={saving}>
                          <EditIcon />
                        </IconButton>

                        <IconButton color='error' onClick={() => handleDelete(activity)} disabled={saving}>
                          <DeleteIcon />
                        </IconButton>
                      </Stack>
                    </Stack>

                    <Divider />
                  </Stack>
                ))
              )}
            </Stack>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleCreate} variant='contained' disabled={saving}>
            Nueva actividad
          </Button>

          <Button onClick={onClose} disabled={saving}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={formOpen} onClose={() => saving || setFormOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>{editingActivity ? 'Editar actividad' : 'Nueva actividad'}</DialogTitle>

        <DialogContent>
          <ActivityForm initialValue={editingActivity} onChange={handleFormChange} />
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setFormOpen(false)} disabled={saving}>
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            variant='contained'
            disabled={saving || !formData.name.trim() || !formData.date || formData.order < 1}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
