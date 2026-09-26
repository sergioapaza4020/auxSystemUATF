'use client';

import { useMemo, useState } from 'react';

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';

import type { IActivity } from '@/interfaces/activities/activity.interface';
import type { IActivityCreate, IActivityUpdate } from '@/api/activities.service';

import { ActivityListItem } from './ActivityListItem';
import { ActivityFormDialog } from './ActivityFormDialog';

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

  const sortedActivities = useMemo(() => [...activities].sort((a, b) => a.order - b.order), [activities]);

  const handleCreate = () => {
    setEditingActivity(null);
    setFormOpen(true);
  };

  const handleEdit = (activity: IActivity) => {
    setEditingActivity(activity);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    if (saving) return;

    setFormOpen(false);
    setEditingActivity(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={saving ? undefined : onClose}
        fullWidth
        maxWidth='md'
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle sx={{ px: 6, pt: 5, pb: 3 }}>
          <Stack spacing={0.5}>
            <Typography variant='h5' fontWeight={600}>
              Actividades
            </Typography>

            <Typography variant='body2' color='text.secondary'>
              {gradeItemName}
            </Typography>
          </Stack>
        </DialogTitle>

        <DialogContent
          sx={{
            px: 6,
            pt: '12px !important',
            pb: 4,
          }}
        >
          {loading ? (
            <Stack alignItems='center' justifyContent='center' spacing={2} sx={{ minHeight: 180 }}>
              <CircularProgress size={32} />

              <Typography variant='body2' color='text.secondary'>
                Cargando actividades...
              </Typography>
            </Stack>
          ) : sortedActivities.length === 0 ? (
            <Box
              sx={{
                py: 8,
                px: 3,
                textAlign: 'center',
                border: 1,
                borderStyle: 'dashed',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Typography fontWeight={600}>Aún no hay actividades</Typography>

              <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                Registra una actividad para comenzar a evaluar este componente.
              </Typography>

              <Button variant='contained' startIcon={<AddIcon />} onClick={handleCreate} sx={{ mt: 4 }}>
                Nueva actividad
              </Button>
            </Box>
          ) : (
            <Stack
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              {sortedActivities.map((activity, index) => (
                <ActivityListItem
                  key={activity.idActivity}
                  activity={activity}
                  divider={index < sortedActivities.length - 1}
                  disabled={saving}
                  onEdit={() => handleEdit(activity)}
                  onDelete={() => onDelete(activity.idActivity)}
                />
              ))}
            </Stack>
          )}
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
            Cerrar
          </Button>

          {sortedActivities.length > 0 && (
            <Button variant='contained' startIcon={<AddIcon />} onClick={handleCreate} disabled={saving}>
              Nueva actividad
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <ActivityFormDialog
        open={formOpen}
        saving={saving}
        activity={editingActivity}
        nextOrder={activities.length > 0 ? Math.max(...activities.map((activity) => activity.order)) + 1 : 1}
        idGradeSchemeDetail={idGradeSchemeDetail}
        onClose={handleCloseForm}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />
    </>
  );
}
