'use client';

import { useState } from 'react';

import { assistantGradeItemLabel, isAssistantGradeItem } from '@repo/grade-calculations/assistant-grade-items';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { getApiErrorMessage } from '@/utils/http/getApiErrorMessage';

import Form from '@components/Form';

import type { IGradeItem } from '@/interfaces/grade-items/grade-item.interface';
import type {
  IAssistantGradeSchemeDetail,
  IAssistantGradeSchemeCreate,
} from '@/interfaces/grade-schemes/assistant-grade-scheme.interface';

import { useAssistantGradeSchemeForm } from '@/hooks/assistant-grade-schemes/useAssistantGradeSchemeForm';

import { GradeSchemeItemsEditor } from '../grade-schemes/components/GradeSchemeItemsEditor';
import { LoadingOverlay } from '@/components/feedback/LoadingOverlay';

interface AssistantGradeSchemeDialogProps {
  open: boolean;
  loading: boolean;
  gradeItems: IGradeItem[];
  loadingGradeItems: boolean;
  initialValue?: IAssistantGradeSchemeCreate;
  archivedDetails?: IAssistantGradeSchemeDetail[];
  onClose: () => void;
  onSubmit: (data: IAssistantGradeSchemeCreate) => Promise<void>;
}

export function AssistantGradeSchemeDialog({
  open,
  loading,
  gradeItems,
  loadingGradeItems,
  initialValue,
  archivedDetails = [],
  onClose,
  onSubmit,
}: AssistantGradeSchemeDialogProps) {
  const {
    form,
    updateField,
    handleGradeItemChange,
    handlePercentageChange,
    handlePermissionWeightChange,
    totalPercentage,
    isValid,
  } = useAssistantGradeSchemeForm({
    initialValue,
  });

  const [pendingRemoval, setPendingRemoval] = useState<IGradeItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const removedDetail = form.details.find((detail) => detail.gradeItem.idGradeItem === pendingRemoval?.idGradeItem);

  const hasData = !!removedDetail?.hasAcademicData;

  const changeGradeItem = (item: IGradeItem, checked: boolean) => {
    if (!checked) setPendingRemoval(item);
    else handleGradeItemChange(item, true);
  };

  const formId = 'assistant-grade-scheme-form';
  const isEditing = !!initialValue;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isValid) return;

    setError(null);

    try {
      await onSubmit(form);
    } catch (cause: unknown) {
      setError(getApiErrorMessage(cause));
    }
  };

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      fullWidth
      maxWidth='md'
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
            {isEditing ? 'Editar evaluación del auxiliar' : 'Configurar evaluación del auxiliar'}
          </Typography>

          <Typography variant='body2' color='text.secondary'>
            Define el porcentaje correspondiente al auxiliar y distribuye los elementos que formarán parte de su
            evaluación.
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
        {error && (
          <Alert severity='error' sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        {!!form.deactivateDetailIds?.length && (
          <Alert severity='warning' sx={{ mb: 3 }}>
            Los criterios retirados se archivarán sin borrar datos. Redistribuye manualmente sus porcentajes hasta sumar
            100%. La configuración activa recalcula la nota vigente de todos los estudiantes.
          </Alert>
        )}
        <Form onSubmit={handleSubmit} id={formId}>
          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 4,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <Grid container spacing={3} alignItems='center'>
                  <Grid item xs={12} sm={8}>
                    <Typography fontWeight={600}>Porcentaje del auxiliar</Typography>

                    <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                      Indica cuánto representa la evaluación del auxiliar dentro de la calificación total de la materia.
                    </Typography>
                  </Grid>

                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      required
                      size='small'
                      type='number'
                      label='Porcentaje'
                      value={form.assistantPercentage || ''}
                      onChange={(event) => updateField('assistantPercentage', Number(event.target.value))}
                      inputProps={{
                        min: 0,
                        max: 100,
                        step: 0.01,
                      }}
                      InputProps={{
                        endAdornment: <Typography color='text.secondary'>%</Typography>,
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label='Nombre'
                placeholder='Ej. Evaluación del auxiliar'
                value={form.name ?? ''}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={4}
                label='Descripción'
                placeholder='Descripción de la evaluación (opcional)'
                value={form.description ?? ''}
                onChange={(event) => updateField('description', event.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <GradeSchemeItemsEditor
                gradeItems={gradeItems.filter(
                  (item) =>
                    isAssistantGradeItem(item) &&
                    !archivedDetails.some((detail) => detail.gradeItem.idGradeItem === item.idGradeItem),
                )}
                getGradeItemLabel={assistantGradeItemLabel}
                details={form.details}
                loading={loadingGradeItems}
                totalPercentage={totalPercentage}
                onGradeItemChange={changeGradeItem}
                onPercentageChange={handlePercentageChange}
                onPermissionWeightChange={handlePermissionWeightChange}
              />
            </Grid>
          </Grid>
        </Form>
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
        <Button variant='outlined' color='inherit' onClick={onClose} disabled={loading}>
          Cancelar
        </Button>

        <Button variant='contained' color='primary' type='submit' form={formId} disabled={loading || !isValid}>
          {isEditing ? 'Guardar cambios' : 'Guardar configuración'}
        </Button>
      </DialogActions>

      <Dialog open={!!pendingRemoval} onClose={() => setPendingRemoval(null)} maxWidth='sm' fullWidth>
        <DialogTitle>{hasData ? 'Desactivar y redistribuir' : 'Eliminar criterio'}</DialogTitle>
        <DialogContent>
          <Typography>
            {pendingRemoval && assistantGradeItemLabel(pendingRemoval.name)}: {removedDetail?.percentage ?? 0}%.
            {hasData
              ? ' Este criterio tiene datos registrados y no puede eliminarse. Se conservarán actividades, notas y asistencia como historial. Dejará de aportar al cálculo vigente.'
              : ' Se retirará este criterio de la configuración. Los criterios sin datos pueden eliminarse.'}{' '}
            Para guardar, redistribuye manualmente su porcentaje entre los criterios restantes hasta sumar 100%.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemoval(null)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (pendingRemoval) handleGradeItemChange(pendingRemoval, false);
              setPendingRemoval(null);
            }}
          >
            {hasData ? 'Desactivar y redistribuir' : 'Eliminar y redistribuir'}
          </Button>
        </DialogActions>
      </Dialog>
      <LoadingOverlay open={loading} />
    </Dialog>
  );
}
